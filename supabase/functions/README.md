# Supabase Edge Functions

This directory contains Supabase Edge Functions for the Mileage Tracker app.

## Functions

### verify-apple-receipt

Verifies Apple In-App Purchase receipts with Apple's servers to ensure legitimate subscriptions.

#### Deployment

1. Install Supabase CLI if you haven't already:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Link your project:
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

4. Set the required environment variable:
```bash
supabase secrets set APPLE_SHARED_SECRET=your_shared_secret_from_app_store_connect
```

To get your Apple Shared Secret:
- Go to App Store Connect
- Navigate to your app
- Go to App Information > App-Specific Shared Secret
- Generate a new shared secret if you don't have one
- Copy and use it in the command above

5. Deploy the function:
```bash
supabase functions deploy verify-apple-receipt
```

#### Testing

You can test the function locally:
```bash
supabase functions serve verify-apple-receipt
```

Then make a POST request:
```bash
curl -X POST http://localhost:54321/functions/v1/verify-apple-receipt \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "receiptData": "BASE64_ENCODED_RECEIPT",
    "transactionId": "TRANSACTION_ID",
    "productId": "com.mileagetracker.monthly"
  }'
```

#### Database Schema

The function updates the `profiles` table. Ensure you have these columns:
- `subscription_status` (text): trial | active | expired | cancelled
- `subscription_expires_at` (timestamp)
- `apple_transaction_id` (text)
- `apple_product_id` (text)
- `apple_environment` (text): Sandbox | Production

Add these columns with:
```sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS apple_product_id text,
ADD COLUMN IF NOT EXISTS apple_environment text;
```

#### Security Notes

- The function validates receipts server-side to prevent client-side tampering
- Uses Supabase JWT authentication to ensure users can only update their own subscription
- Shared secret is stored securely in Supabase secrets (never in code)
- Handles both sandbox and production receipts automatically
