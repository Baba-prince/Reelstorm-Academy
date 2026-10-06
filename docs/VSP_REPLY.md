# VSP / VisaVideos — REELSTORM status reply

**To:** VisaVideos / VisaGuideOS (VSP)  
**From:** REELSTORM ACADEMY OS  
**Date:** 2026-10-06  
**Hosts:** marketing `reelstorm.uk` · app `app.reelstorm.uk` · api `api.reelstorm.uk`  
**Repo:** https://github.com/Beeplus7/Reelstorm-Academy (`main`)

## Shipped

1. **Google + email auth** — Gmail OAuth + email/password with **confirmation email required** (branded “Confirm your REELSTORM account”).
2. **Onboarding** — Storm Passport wizard after confirm.
3. **Domain split** — `reelstorm.uk` marketing · `app.reelstorm.uk` factory login/content.
4. **Stripe tiers** — VisaVideos Journey £39 / Journey Pro £89 → Storm / Storm Pro + RTC wallet sync.
5. **Nollywood + Asia** template packs in Templates Room.

## Deploy status (IONOS UK `87.106.103.43`)

- Code **pushed** to GitHub (`e1b19c9` + deploy script).
- Deploy script ready: `scripts/deploy-vps.sh`
- **Blocked on SSH:** root password from the IONOS panel was rejected (`Permission denied`).  
  **Need:** reset root password in IONOS **or** install this SSH public key for passwordless deploy, then rerun the script.

```bash
export VPS=root@87.106.103.43
export SSHPASS='…'   # or use ssh-agent
bash scripts/deploy-vps.sh
```

## Ask VSP / ops

1. Unlock VPS SSH (password reset or `authorized_keys`).
2. Point DNS A → `87.106.103.43` for `reelstorm.uk`, `www`, `app`, `api`.
3. After API is live, Stripe webhook: `https://api.reelstorm.uk/api/billing/stripe-webhook`.
4. Google Console: keep Supabase callback  
   `https://bytbilbaykzrjofhttyt.supabase.co/auth/v1/callback`.
