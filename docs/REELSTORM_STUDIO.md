# ReelStorm Studio (Option 2) — user’s GPU, central minutes

## Model
- **Compute:** user’s RTX (SkyReels V2 DF 1.3B — weights download on first run)
- **Control:** `StudioLicense` + heartbeat + usage API (source of truth for minutes)
- **MRR:** Stripe subscription; cancel → heartbeat returns `canceled` → app blocks

## Security
- License JWT (`RSTUDIO-<jwt>`) signed with `STUDIO_LICENSE_SECRET` (HS256)
- Only `keyHash` stored; plaintext shown once (email / dashboard regenerate)
- Activation binds `sha256(cpu+gpu+mac+board)` fingerprint
- `activated_token` 7-day TTL, refreshed hourly; offline grace 72h
- Device slots per plan; deactivate in `/settings/studio`

## API
| Route | Purpose |
|-------|---------|
| `POST /api/studio/checkout` | Stripe Studio plan |
| `POST /api/license/activate` | Bind device |
| `GET /api/license/validate` | Remaining minutes |
| `POST /api/license/usage` | Report minutes after local gen |
| `POST /api/license/heartbeat` | Refresh token + Stripe status |
| `POST /api/license/devices/:id/deactivate` | Free seat |
| `POST /api/license/regenerate` | New key / bump jwtVersion |
| `POST /api/license/issue-free` | 5-min free test license |

## Desktop
`packages/desktop` — Electron scaffold + license IPC. Real ComfyUI/SkyReels binary is stubbed until weights URL is set.

```bash
npm install -w @reelstorm/desktop
npm run studio:build
# then electron-builder via npm run build:studio -w @reelstorm/desktop
```

## Env
See `.env.example` — `STUDIO_LICENSE_SECRET`, `STRIPE_PRICE_STUDIO_*`.
