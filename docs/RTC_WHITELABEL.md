# RTC + White-label (VisaVideos-aligned)

## Source

Adopted from `Documents/passport-paper` → `StripePriceTierService.ts`:

| VisaVideos | Price | ReelStorm |
|------------|-------|-----------|
| Free | Free | **Studio** |
| Journey | £39/mo | **Storm** |
| Journey Pro | £89/mo | **Storm Pro** |
| Enterprise / white-label | Custom | **Network** |

## RTC unit

- **100 RTC = 1 ARCHIVE5 block (5 minutes)**
- Monthly pools: Studio 300 · Storm 1,500 · Storm Pro 4,000 · Network 20,000

## White-label API

Base: `/v1/wl/*` · Auth: `Authorization: Bearer rs_live_…`

Provision UI: http://localhost:3000/white-label  
Docs: http://localhost:3000/developers  
Pricing: http://localhost:3000/pricing  
Wallet: http://localhost:3000/wallet
