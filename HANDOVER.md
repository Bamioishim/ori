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
- Extra screens hidden for the submission: Scanner, Earn, Privacy are filtered out via `HIDDEN_SCREENS` in `app/src/config.ts` (nav, drawer, home links, chat "go" actions fall back to Home). Policy & limits stays visible because it holds the AI spending cap (#7).
- Ori assistant moved off the numbers (not covering the balance).
- Already present: spending cap for the AI (Ori can't pay above the cap without a tap) and payee-chooses-chain/asset.
- Request slice now present: local request records with amount, token, network, handle/address, copyable `ori://` link, QR code, and local cancellation. Server persistence, notifications, and settlement are still open.

## Product doc v2 (latest PDF) — applied so far
- **Hey ORI = click activation only.** Clicking/tapping Hey ORI opens and focuses the chat. No microphone, no wake word, no speech recognition (removed from `voice.ts`; opt-in text-to-speech "Ori speaks replies" kept). Static check: `cd app && npm run check:activation`.
- Unsupported privacy claims removed or marked **PLANNED**: per-chain Chain Signatures addresses, fresh deposit address per payment, NEAR AI Cloud private inference (TEE/attestation). The chat is a local rule-based assistant, no AI model.
- Not done yet (doc direction, not approved scope): real NEAR AI Cloud inference, Security Center merging Scanner/Security/Policy, dynamic network/token discovery. Key import/export stays deferred until custody is approved.

## Honest blockers (as of Nov 5)
- **Recovery is local-only.** Gmail code verify works only on the device that already holds the ORI profile (`localStorage`); cross-device restore needs a server account store, which is not approved.
- **Gmail OAuth2 recovery mail is unverified.** Needs the server env vars listed in `app/.env.example` (names only; never commit values). No delivery test has been done.
- **Live payment route today is Base USDC → Solana USDC** via 1Click (payer's Base wallet signs the deposit, refund to that wallet, recipient a Solana address or a handle in `ORI_HANDLE_DIRECTORY`). It does not use a NEAR account. Needs `VITE_ORI_SETTLEMENT_MODE=live` in a deployed build (Vercel `/api`).
- **1Click JWT:** the public API works without one but adds a 0.25% platform fee (docs: API Keys page). The code deliberately refuses live quotes without `ORI_1CLICK_JWT`. **Do not remove that guard without Bamio's fee decision.** ORI sets no `appFees` of its own.

## Open items (need Bamio)
- Per-swap fee figure — needs Bamio's approval before shipping.
- Bamio's NEAR account — still needed for the real payment.
- Making the repo public, signing any mainnet tx, posting or submitting — only with Bamio's explicit OK.
