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

## Status at commit 56ae683 (Nov 5, local, not pushed)
All "IMPLEMENTED" items are mocked/unit/static tested only. `cd app && npm test` runs 63 node tests and 20 static checks, all passing.

| Area | Status |
|---|---|
| Native Send: ETH and USDC on Ethereum and Base | IMPLEMENTED (mocked): EIP-1193, chain and account re-check, receipt poll |
| Native Send: SOL | IMPLEMENTED (mocked): Phantom, rent-exempt recipient check |
| Native Send: USDC and USDT on Solana (SPL) | IMPLEMENTED (mocked): pinned mints, `transferChecked`, token account created only when missing, rent shown |
| Send: NEAR, other SPL tokens, other EVM chains | NOT SUPPORTED: shown disabled, never simulated |
| Receive (real wallet and watched addresses only) | IMPLEMENTED (mocked) |
| Swap quotes (every catalog token) | IMPLEMENTED; non-signable origins labelled "quote only" |
| Live swap execution | IMPLEMENTED (mocked): bound quote → direct deposit (no approvals) → status poll; completed only on SUCCESS |
| Swap with settlement off | EXAMPLE simulation, labelled as such |
| Gmail code register/login | BLOCKED in production: the endpoints return 503 (see below) |
| Spending limits | Browser app only, fail-closed; no backend or contract enforcement |

## Pay hardening (review fixes, Nov 5)
IMPLEMENTED, behavior-tested with mocks only (`app/tests/pay.test.ts`).
- **Live vs example:** in live mode the Pay review is built by `preparePay` (`src/payExec.ts`) and shows "LIVE · YOUR WALLET SIGNS" together with the exact plan: route, account, deposit address, recipient, refund address, minimum received and expiry. With settlement off, the sheet says "EXAMPLE · SIMULATED". Live `doPay` signs only the reviewed plan; there is no fresh re-quote after review.
- **Quote binding:** `checkSwapQuote` checks the origin and destination asset IDs, the exact amount, recipient, refund address, minAmountOut of at least the reviewed floor, a deadline more than 30 s away (a missing deadline is rejected), no memo, and the Base deposit-address format. It runs at review and again at signing.
- **Spend holds:** spend is reserved per transaction id once a deposit is broadcast. On REFUNDED or failed, the hold is released exactly once (idempotent) without touching other spends. A tampered ledger is never "repaired". REFUNDED is now its own terminal history state instead of pending. Swap uses the same holds.
- **Signer checks:** `connectBaseWallet` re-reads the chain after switching. All Base signing (both the direct path and the Intents deposit) goes through `sendEvm`: chain re-check, account check, then a receipt poll. Only a `0x1` receipt counts as confirmed; `0x0` is failed; no receipt means pending. The broadcast-only helpers `sendBaseUSDC`/`depositBaseUSDC`/`checkDepositQuote` were removed.

## Honest blockers (as of Nov 5)
- **Gmail code auth returns 503.** The missing pieces:
  1. A durable store for `AuthStore` (`app/api/auth/_store.ts`, `getAuthStore()` currently returns null), e.g. a Redis/KV. It must provide atomic `hit` (rate limits) and `consumeOnce` (one-time codes).
  2. A signed server session: none exists, and profiles are device-local.
  3. Mail delivery env: `MAIL_OAUTH_USER`, `MAIL_OAUTH_FROM`, `MAIL_OAUTH_REFRESH_TOKEN` (plus the OAuth client credentials) and `ORI_AUTH_CODE_SECRET`. Delivery has never been tested.

  All of this needs Bamio's decision. Names only; never commit values.
- **Provider quotes:** 1Click dry quotes were timing out server-side on Nov 5, so no real quote or status response has been traced.
- **Not verified:** no live wallet signature, payment or on-chain transfer; no phone/mobile check.
- **Recovery is local-only.** Cross-device restore needs the server account store above.
- **Live settlement** needs `VITE_ORI_SETTLEMENT_MODE=live`, `ORI_SETTLEMENT_MODE`, `ORI_1CLICK_JWT` (and optionally `ORI_HANDLE_DIRECTORY`) in a server deployment. Deploying needs Bamio's OK.
- **1Click JWT:** the public API works without one but adds a 0.25% platform fee (docs: API Keys page). The code deliberately refuses live quotes without `ORI_1CLICK_JWT`. **Do not remove that guard without Bamio's fee decision.** ORI sets no `appFees` of its own.

## Open items (need Bamio)
- Per-swap fee figure — needs Bamio's approval before shipping.
- Bamio's NEAR account — still needed for the real payment.
- Making the repo public, signing any mainnet tx, posting or submitting — only with Bamio's explicit OK.
