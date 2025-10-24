# Supabase Setup Guide for Mileage Tracker

This guide walks you through deploying the Apple IAP receipt verification Edge Function.

## Prerequisites

- Access to your Supabase project dashboard
- Access to App Store Connect (to get the Apple Shared Secret)
- Terminal/Command Prompt

---

## Step 1: Get Your Apple Shared Secret

1. **Go to App Store Connect**: https://appstoreconnect.apple.com
2. **Navigate to your app**:
   - Click "My Apps"
   - Select your Mileage Tracker app
3. **Get the Shared Secret**:
   - Click on "App Information" in the left sidebar
   - Scroll down to "App-Specific Shared Secret"
   - Click "Manage" or "Generate" if you don't have one
   - **Copy this value** - you'll need it in Step 3

> **Note**: Keep this secret secure! Don't commit it to git or share it publicly.

---

## Step 2: Get Your Supabase Project Details

1. **Go to your Supabase Dashboard**: https://app.supabase.com
2. **Select your project** (or create one if you haven't already)
3. **Get your Project Reference ID**:
   - Go to Settings (gear icon in sidebar)
   - Click "General"
   - Copy the "Reference ID" (it looks like: `abcdefghijklmnop`)
   - Save this for the next step

---

## Step 3: Login to Supabase

Open your terminal in the project directory and run:

```bash
npx supabase login
```

This will:
1. Open a browser window
2. Ask you to authorize the CLI
3. Generate an access token

---

## Step 4: Link Your Project

Link your local project to your Supabase project:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

Replace `YOUR_PROJECT_REF` with the Reference ID from Step 2.

When prompted for the database password, enter your Supabase database password.

> **Don't know your password?** Go to Supabase Dashboard → Settings → Database → Reset password

---

## Step 5: Set the Apple Shared Secret

Set the Apple Shared Secret as an environment variable in Supabase:

```bash
npx supabase secrets set APPLE_SHARED_SECRET="your_shared_secret_here"
```

Replace `your_shared_secret_here` with the value from Step 1.

> **Important**: Keep the quotes around the secret!

To verify it was set correctly:

```bash
npx supabase secrets list
```

You should see `APPLE_SHARED_SECRET` listed (but not the actual value - it's encrypted).

---

## Step 6: Deploy the Edge Function

Deploy the receipt verification function:

```bash
npx supabase functions deploy verify-apple-receipt
```

This will:
1. Bundle the TypeScript code
2. Upload it to Supabase
3. Make it available at: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/verify-apple-receipt`

You should see output like:
```
Bundled verify-apple-receipt in Xms
Deployed verify-apple-receipt to project YOUR_PROJECT_REF
```

---

## Step 7: Update Database Schema

You need to add two new columns to the `profiles` table.

### Option A: Using Supabase Dashboard (Easiest)

1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Paste this SQL:

```sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS apple_product_id text,
ADD COLUMN IF NOT EXISTS apple_environment text;
```

4. Click "Run" or press `Ctrl+Enter`

### Option B: Using Supabase CLI

```bash
npx supabase db execute "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS apple_product_id text, ADD COLUMN IF NOT EXISTS apple_environment text;"
```

---

## Step 8: Test the Edge Function

### Test in Browser (Quick Test)

1. Get your function URL:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/verify-apple-receipt
   ```

2. You can test it's deployed by visiting the URL - you should get an error about missing authorization (which is expected!)

### Test with Real Data (After First Purchase)

The function will be automatically called by your app when a user makes a purchase. Check the logs:

1. Go to Supabase Dashboard → Edge Functions → verify-apple-receipt
2. Click "Logs" to see function invocations
3. Look for `[Apple Verify]` log entries

---

## Step 9: Verify Everything is Working

### Check Function is Deployed
```bash
npx supabase functions list
```

You should see `verify-apple-receipt` listed.

### Check Secrets are Set
```bash
npx supabase secrets list
```

You should see `APPLE_SHARED_SECRET` listed.

### Check Database Schema
```bash
npx supabase db execute "SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND column_name IN ('apple_product_id', 'apple_environment');"
```

You should see both columns listed.

---

## Troubleshooting

### "Login failed" or "Access token expired"
Run `npx supabase login` again and reauthorize.

### "Project not found"
Double-check your Project Reference ID in the Supabase Dashboard.

### "Database password incorrect"
Reset your password in Supabase Dashboard → Settings → Database.

### Edge Function not deploying
Make sure the files exist:
- `supabase/functions/verify-apple-receipt/index.ts`
- `supabase/config.toml`

### Function returns error when called
Check the function logs in Supabase Dashboard → Edge Functions → verify-apple-receipt → Logs.

Common issues:
- `APPLE_SHARED_SECRET` not set correctly
- Database columns not created
- User not authenticated (missing JWT token)

---

## Testing in Development

### Sandbox Environment
- The function automatically detects sandbox receipts
- Test with TestFlight builds
- Receipts from simulator/sandbox will work

### Production Environment
- Use only after app is approved and live in App Store
- Production receipts will be verified against production Apple servers

---

## Security Notes

✅ **DO:**
- Keep your Apple Shared Secret secure
- Use environment variables (not hardcoded values)
- Monitor function logs for suspicious activity
- Rotate shared secret periodically

❌ **DON'T:**
- Commit secrets to git
- Share your shared secret publicly
- Use production shared secret in development
- Skip receipt verification

---

## Next Steps After Deployment

1. **Test with a sandbox purchase** using TestFlight
2. **Monitor the function logs** for the first few purchases
3. **Check the `profiles` table** to ensure subscription status is updating
4. **Set up monitoring** for function errors (Supabase Dashboard → Edge Functions → verify-apple-receipt → Invocations)

---

## Quick Reference Commands

```bash
# Login
npx supabase login

# Link project
npx supabase link --project-ref YOUR_PROJECT_REF

# Set secret
npx supabase secrets set APPLE_SHARED_SECRET="your_secret"

# List secrets
npx supabase secrets list

# Deploy function
npx supabase functions deploy verify-apple-receipt

# List functions
npx supabase functions list

# View function logs
npx supabase functions logs verify-apple-receipt

# Execute SQL
npx supabase db execute "YOUR SQL HERE"
```

---

## Support

If you encounter issues:
1. Check function logs in Supabase Dashboard
2. Verify all secrets are set: `npx supabase secrets list`
3. Check database schema: columns exist in `profiles` table
4. Review the error messages in the app logs (`[Apple IAP]` prefix)

---

## Summary Checklist

Before going to production, verify:

- [ ] Supabase CLI installed/working (npx supabase)
- [ ] Logged into Supabase
- [ ] Project linked
- [ ] Apple Shared Secret set in Supabase secrets
- [ ] Edge Function deployed successfully
- [ ] Database columns added (`apple_product_id`, `apple_environment`)
- [ ] Function tested with sandbox purchase
- [ ] Function logs show successful verification
- [ ] Subscription status updating in `profiles` table

Once all checkboxes are complete, your Apple IAP verification is production-ready! ✅
