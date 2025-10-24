// Supabase Edge Function to verify Apple IAP receipts
// This ensures purchases are legitimate before granting access

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Apple's receipt verification endpoints
const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

interface AppleReceiptRequest {
  receiptData: string;
  transactionId: string;
  productId: string;
}

interface AppleVerifyResponse {
  status: number;
  receipt?: any;
  latest_receipt_info?: any[];
  pending_renewal_info?: any[];
  environment?: 'Sandbox' | 'Production';
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Get the receipt data from request body
    const { receiptData, transactionId, productId }: AppleReceiptRequest = await req.json();

    if (!receiptData) {
      return new Response(
        JSON.stringify({ error: 'Receipt data is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the shared secret from environment variables
    // You need to set this in your Supabase project settings
    const appleSharedSecret = Deno.env.get('APPLE_SHARED_SECRET');

    if (!appleSharedSecret) {
      console.error('[Apple Verify] APPLE_SHARED_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Prepare request to Apple
    const requestBody = {
      'receipt-data': receiptData,
      'password': appleSharedSecret,
      'exclude-old-transactions': true,
    };

    // Try production first
    console.log('[Apple Verify] Verifying receipt with Apple production server...');
    let response = await fetch(APPLE_PRODUCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    let verifyResult: AppleVerifyResponse = await response.json();

    // If status is 21007, receipt is from sandbox environment - try sandbox
    if (verifyResult.status === 21007) {
      console.log('[Apple Verify] Receipt is from sandbox, retrying with sandbox server...');
      response = await fetch(APPLE_SANDBOX_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      verifyResult = await response.json();
    }

    // Check verification status
    // 0 = valid, 21000-21010 = various errors
    if (verifyResult.status !== 0) {
      console.error('[Apple Verify] Receipt verification failed:', verifyResult.status);

      const errorMessages: Record<number, string> = {
        21000: 'The App Store could not read the JSON object you provided.',
        21002: 'The data in the receipt-data property was malformed or missing.',
        21003: 'The receipt could not be authenticated.',
        21004: 'The shared secret you provided does not match the shared secret on file.',
        21005: 'The receipt server is not currently available.',
        21006: 'This receipt is valid but the subscription has expired.',
        21007: 'This receipt is from the test environment.',
        21008: 'This receipt is from the production environment.',
        21010: 'This receipt could not be authorized.',
      };

      return new Response(
        JSON.stringify({
          verified: false,
          error: errorMessages[verifyResult.status] || `Unknown error: ${verifyResult.status}`,
          status: verifyResult.status,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Receipt is valid! Parse subscription details
    console.log('[Apple Verify] Receipt verified successfully');

    // Get latest subscription info
    const latestReceiptInfo = verifyResult.latest_receipt_info?.[0];
    const pendingRenewalInfo = verifyResult.pending_renewal_info?.[0];

    if (!latestReceiptInfo) {
      return new Response(
        JSON.stringify({
          verified: false,
          error: 'No subscription information found in receipt',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse subscription dates
    const expiresDateMs = parseInt(latestReceiptInfo.expires_date_ms || '0', 10);
    const expiresDate = new Date(expiresDateMs);
    const now = new Date();
    const isActive = expiresDate > now;

    // Determine subscription status
    let subscriptionStatus: 'trial' | 'active' | 'expired' | 'cancelled' = 'expired';

    if (isActive) {
      // Check if it's a trial or regular subscription
      const isTrialPeriod = latestReceiptInfo.is_trial_period === 'true';
      subscriptionStatus = isTrialPeriod ? 'trial' : 'active';
    } else if (pendingRenewalInfo?.auto_renew_status === '0') {
      subscriptionStatus = 'cancelled';
    }

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT token
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('[Apple Verify] Error getting user:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update user's profile with verified subscription
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_status: subscriptionStatus,
        subscription_expires_at: expiresDate.toISOString(),
        apple_transaction_id: transactionId,
        apple_product_id: productId,
        apple_environment: verifyResult.environment,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[Apple Verify] Error updating profile:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update subscription status' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Apple Verify] ✅ Updated user ${user.email} with subscription: ${subscriptionStatus}`);

    // Return verification result
    return new Response(
      JSON.stringify({
        verified: true,
        subscriptionStatus,
        expiresAt: expiresDate.toISOString(),
        isActive,
        productId: latestReceiptInfo.product_id,
        transactionId: latestReceiptInfo.transaction_id,
        environment: verifyResult.environment,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('[Apple Verify] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
