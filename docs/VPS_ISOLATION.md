# VPS multi-project isolation — REELSTORM vs your other 3 apps

Same IONOS box (`87.106.103.43`) can host multiple products. ReelStorm is fenced as follows:

| Resource | ReelStorm | Other projects |
|---|---|---|
| Code dir | `/opt/reelstorm-os` only | Their own `/opt/…` or `/var/www/…` |
| PM2 names | `reelstorm-api`, `reelstorm-worker`, `reelstorm-web` | Untouched (deploy never `pm2 delete` others) |
| Ports | **3017** (web), **4017** (api) | Keep 3000/4000/etc. |
| Redis | DB **`/17`** (requires `databases 32` in redis.conf) + `BULLMQ_PREFIX=reelstorm` | Other DBs / prefixes |
| ffmpeg / ffprobe | `apt install ffmpeg` on VPS | Template Forge analyze |
| Nginx | File `sites-available/reelstorm` · `server_name *.reelstorm.uk` only | Other site files stay in `sites-enabled` |
| SSL | `certbot --cert-name reelstorm.uk` for reelstorm hosts only | Their certs unchanged |
| Uploads | `/opt/reelstorm-os/tmp/uploads` | Separate paths |
| Database | Supabase project `bytbilbaykzrjofhttyt` (ReelStorm Academy) | Their own DB projects |

## Rules the deploy script follows

1. Inventory ports / PM2 / nginx **before** changing anything.
2. Never `rm` other `sites-enabled` entries (including `default`).
3. Never restart or delete PM2 apps unless the name starts with `reelstorm-` (legacy `rs-*` cleaned once).
4. Shared `nginx` + `redis-server` packages are OK; isolation is by **vhost / port / Redis DB / BullMQ prefix**.

## Ops checklist

```bash
# On VPS — confirm no clash
ss -tlnp | grep -E '3017|4017|3000|4000'
pm2 status
ls /etc/nginx/sites-enabled/
redis-cli -n 17 ping
```
