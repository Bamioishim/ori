# ORI — handover

**ORI ("One Balance")**: one balance for all your money across Ethereum, Base, Solana and NEAR; pay or swap anything in one tap, settled through **NEAR Intents**. Built for the NEAR hackathon: build window **1–14 Nov 2026**, submissions close **15 Nov 2026, 12:59 AM WAT** (14 Nov 23:59 UTC). Repo must be public by the deadline — only Bamio decides when to flip it.

See `PLAN.md` for full architecture and links, `app/README.md` for app notes.

## Stack
- `app/` — mobile-first web app: React 19 + Vite + TypeScript, motion, lenis, qrcode-generator. Playwright scripts (`shoot-*.mjs`, `qa-mobile.mjs`) for screenshots and mobile QA.
- App name lives in `app/src/config.ts` (`APP_NAME`).
- `brand/`, `mascot/` — logo and Ori mascot art. `shots/` — QA screenshots.
- Settlement: NEAR Intents 1Click API (`https://1click.chaindefuser.com/v0/…`). Scam check: GoPlus API.

## Run / deploy
```
cd app && npm install && npm run dev     # localhost:5173
npm run build                            # static build in app/dist
```
Deployed as a static Vite site on Vercel (preview project `ori-preview`). Linking this repo in Vercel (Settings → Git, root `app`) makes every push redeploy. Never commit `.env` files or keys (1Click JWT, NEAR keys) — set them as Vercel env vars.

## Approved plan for the hackathon (cut-down scope)
1. **Home** — one total balance.
2. **Receive** — payee picks the chain and asset they get paid in (already built).
3. **One real NEAR Intents payment** end to end, with a receipt that shows the reason/route.
4. **Request** — ask someone for money by handle.
5. **NEW: Invoicing** — a Request with line items; the payer pays in any asset they hold, NEAR Intents converts it, the payee receives their chosen asset, and an exportable receipt (CSV/PDF) is produced for their accountant.
- Extra screens (Scanner, Policy, Swap extras, etc.) hidden for the submission.
- Ori assistant moved off the numbers (not covering the balance).
- Already present: spending cap for the AI (Ori can't pay above the cap without a tap) and payee-chooses-chain/asset.

## Open items (need Bamio)
- Per-swap fee figure — needs Bamio's approval before shipping.
- Bamio's NEAR account — still needed for the real payment.
- Making the repo public, signing any mainnet tx, posting or submitting — only with Bamio's explicit OK.
