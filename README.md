# PulseChat — Production Real-Time Messaging App

Complete React + TypeScript + Tailwind CSS + Supabase application with real email OTP delivery, PostgreSQL Row Level Security (RLS), Supabase Realtime messaging, presence tracking, and group chats.

## Step 1: Create Your Free Supabase Backend
1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Open **SQL Editor** in your Supabase Dashboard, paste the entire contents of `supabase/schema.sql`, and click **Run**.

## Step 2: Configure Real 6-Digit Email OTP Delivery
1. In Supabase Dashboard, go to **Authentication → Emails (Templates)** and select **Confirm signup** (and **Reset password**).
2. Replace `{{ .ConfirmationURL }}` in the email HTML body with `{{ .Token }}` so Supabase emails a **6-digit OTP code** instead of a link.
3. For unlimited real email delivery to any address, go to **Authentication → Emails → SMTP Settings**, enable **Custom SMTP**, and connect a free SMTP sender such as **Resend** (`smtp.resend.com`, port `465` or `587`, username `resend`, password `YOUR_RESEND_API_KEY`) or **Brevo**.

## Step 3: Publish to a Public Website (Vercel or Netlify)
1. Copy `.env.example` to `.env` and add your **Project URL** and **anon public key** from **Supabase → Project Settings → API**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. Push this folder to a GitHub repository and import it into [vercel.com](https://vercel.com) (or run `npx vercel --prod` from this folder).
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel **Project Settings → Environment Variables**, then deploy.
4. Copy your live public URL (e.g., `https://your-app.vercel.app`) into **Supabase → Authentication → URL Configuration → Site URL**. Anyone with your link can now register with their real email, verify their 6-digit OTP, and chat live!
