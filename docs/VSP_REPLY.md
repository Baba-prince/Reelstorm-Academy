# VSP / VisaVideos — REELSTORM status reply

**To:** VisaVideos / VisaGuideOS (VSP)  
**From:** REELSTORM ACADEMY OS  
**Date:** 2026-10-06  
**Hosts:** marketing `reelstorm.uk` · app `app.reelstorm.uk`

## Done this session

1. **Google Auth (Gmail)** — OAuth client `REELSTORM ACADEMY` (VisaguideOS GCP project) wired for:
   - Origins: `reelstorm.uk`, `app.reelstorm.uk`, `localhost:3000`
   - Callbacks: `/auth/callback` on those hosts
   - Sign-in / Sign-up UI + Supabase session exchange
   - **Action for you:** add Client ID + Secret in Supabase Auth → Providers → Google, and add Supabase callback `https://bytbilbaykzrjofhttyt.supabase.co/auth/v1/callback` to the Google OAuth client redirect URIs.

2. **Onboarding wizard** — 5-step Storm Passport (role → region Nollywood/Asia → first ideal → tier interest → factory).

3. **Domain split** — middleware: marketing site stays on `reelstorm.uk`; factory login/content on `app.reelstorm.uk`.

4. **Stripe tiers (VisaVideos sync)** — reused Journey £39 / Journey Pro £89 price IDs:
   - `price_1TyGgl…` → Storm
   - `price_1TyGgy…` → Storm Pro  
   Checkout + webhook updates Prisma `User.tier` + RTC grant (same pattern as passport-paper `create-tier-checkout` / `stripe-tier-webhook`).

5. **Templates** — Nollywood Nigeria + Asia cinema packs live in Templates Room.

## VPS (IONOS UK)

- IP `87.106.103.43` · Ubuntu 24.04 · 6 vCPU / 8GB / 240GB  
- Point DNS: `reelstorm.uk` + `www` → marketing; `app.reelstorm.uk` → app  
- **Security:** root password was shared in chat — rotate it in IONOS before production.

## Ask from REELSTORM → VSP

- Confirm Stripe webhook endpoint can point at `https://api.reelstorm.uk/api/billing/stripe-webhook` (or shared) with the Journey tier webhook secret.
- Confirm Google consent screen test users include the launch producers.
- Publish Google OAuth out of Testing when ready for public signup.
