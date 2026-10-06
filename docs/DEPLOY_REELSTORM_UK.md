# Deploy sketch — reelstorm.uk / app.reelstorm.uk

Host: IONOS VPS `87.106.103.43` (Ubuntu 24.04)

## DNS
- `reelstorm.uk` A → 87.106.103.43
- `www.reelstorm.uk` A → 87.106.103.43
- `app.reelstorm.uk` A → 87.106.103.43
- `api.reelstorm.uk` A → 87.106.103.43 (recommended for API)

## Process (high level)
1. Rotate root password (do not reuse chat password).
2. Install Node 20+, Redis, nginx/Caddy, certbot.
3. Clone repo, copy `.env` with Google + Stripe + Supabase secrets (never commit).
4. `npm install && npm run build && npx prisma db push`
5. Run `api` :4000, `worker`, `web` :3000 (or PM2).
6. Reverse proxy:
   - `reelstorm.uk` / `www` → web :3000
   - `app.reelstorm.uk` → web :3000
   - `api.reelstorm.uk` → api :4000
7. Stripe webhook → `https://api.reelstorm.uk/api/billing/stripe-webhook`
8. Supabase Google provider: paste `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`; add Supabase callback URI in Google Console.
