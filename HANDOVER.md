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

## Status at commit 6bf4ff8 (6 Nov 2026, on `submission-hide-extras`, production https://ori-preview.vercel.app/)
All "IMPLEMENTED" items are mocked/unit/static tested only unless noted. Earlier suite on this line reported **138 unit + 31 activation** checks passing; that coverage was **not** freshly re-run for this docs update. **Not payment-ready.** Spending limits are browser-side only — do not claim on-chain security enforcement.

| Area | Status |
|---|---|
| Node/Web runtime adapter (`app/api/_runtime.ts`) | FIXED at `6bf4ff8`: relative URL + exact Buffer body copy (no pooled ArrayBuffer leak). Public smokes previously seen: `/api/resolve` `@tolu` → 404; `/api/status` without `depositAddress` → 400; `/api/quote` GET → 405 |
| Native Send: ETH and USDC on Ethereum and Base | IMPLEMENTED for **connected** wallets (mocked): EIP-1193, chain and account re-check, receipt poll — not mainnet-verified |
| Native Send: SOL | IMPLEMENTED for connected Phantom (mocked): rent-exempt recipient check |
| Native Send: USDC and USDT on Solana (SPL) | IMPLEMENTED for connected wallets (mocked): pinned mints, `transferChecked`, token account created only when missing, rent shown |
| ORI-created wallets (passkey + email recovery) | **NOT BUILT.** Connect/import-first only; custody, signer, recovery and gas unimplemented. Desired core direction — blocked on product build + pending NEAR Auth |
| Send: NEAR, other SPL tokens, other EVM chains | NOT SUPPORTED / quote-only where shown; never simulated as success |
| Receive (real wallet and watched addresses only) | IMPLEMENTED (mocked) |
| Swap quotes (every catalog token) | IMPLEMENTED; non-signable / NEAR origins labelled "quote only" |
| Live swap / Pay execution | Code + mocks exist; runtime responds; **real mainnet signing/settlement not end-to-end verified** |
| Demo Pay `@tolu` | EXAMPLE · SIMULATED receipt/history only — no funds; not a registered live recipient |
| Swap with settlement off | EXAMPLE simulation, labelled as such |
| Gmail code register/login | BLOCKED in production: durable store / session / mail provisioning missing → fail-closed 503 |
| NEAR Auth (production) | **Pending.** Official form submitted ~00:02 WAT 6 Nov 2026 (origin + callback `https://ori-preview.vercel.app`, initial MAU under 1000). Follow-up to Peersyst general contact ~01:53 WAT. Last Gmail check (inbox + spam + trash) **09:20 WAT 6 Nov 2026**: **no approval/reply**. No timeline. Approval ≠ wallet implementation |
| Spending limits | Browser app only, fail-closed; no backend or contract enforcement |
| iPhone / mobile speech | Not end-to-end verified |

## Pay hardening (review fixes, Nov 5)
IMPLEMENTED, behavior-tested with mocks only (`app/tests/pay.test.ts`).
- **Live vs example:** in live mode the Pay review is built by `preparePay` (`src/payExec.ts`) and shows "LIVE · YOUR WALLET SIGNS" together with the exact plan: route, account, deposit address, recipient, refund address, minimum received and expiry. With settlement off, the sheet says "EXAMPLE · SIMULATED". Live `doPay` signs only the reviewed plan; there is no fresh re-quote after review.
- **Quote binding:** `checkSwapQuote` checks the origin and destination asset IDs, the exact amount, recipient, refund address, minAmountOut of at least the reviewed floor, a deadline more than 30 s away (a missing deadline is rejected), no memo, and the Base deposit-address format. It runs at review and again at signing.
- **Spend holds:** spend is reserved per transaction id once a deposit is broadcast. On REFUNDED or failed, the hold is released exactly once (idempotent) without touching other spends. A tampered ledger is never "repaired". REFUNDED is now its own terminal history state instead of pending. Swap uses the same holds.
- **Signer checks:** `connectBaseWallet` re-reads the chain after switching. All Base signing (both the direct path and the Intents deposit) goes through `sendEvm`: chain re-check, account check, then a receipt poll. Only a `0x1` receipt counts as confirmed; `0x0` is failed; no receipt means pending. The broadcast-only helpers `sendBaseUSDC`/`depositBaseUSDC`/`checkDepositQuote` were removed.

## Honest blockers (as of 6 Nov 2026, commit `6bf4ff8`)
- **ORI-created wallets not built.** Connect/import-first does not meet the desired core (passkey + email recovery). Custody, signer, recovery and gas remain unimplemented. **NEAR Auth production access is pending** (see status table); when approved it enables work — it does not ship wallet features by itself.
- **Gmail code auth returns 503.** The missing pieces:
  1. A durable store for `AuthStore` (`app/api/auth/_store.ts`, `getAuthStore()` currently returns null), e.g. a Redis/KV. It must provide atomic `hit` (rate limits) and `consumeOnce` (one-time codes).
  2. A signed server session: none exists, and profiles are device-local.
  3. Mail delivery / provisioning env (OAuth client + refresh + from/user names, plus `ORI_AUTH_CODE_SECRET`). Delivery has never been tested.

  All of this needs Bamio's decision. Names only; never commit values or personal addresses.
- **Provider / live settlement:** runtime adapter is fixed; real non-dry quote → deposit → SUCCESS on mainnet has not been verified end to end. 1Click dry quotes sometimes timed out on Nov 5.
- **Not verified:** no live wallet signature, payment or on-chain transfer by the team; no phone / iPhone speech check.
- **Recovery is local-only.** Cross-device restore needs the server account store above.
- **Live settlement env** on production already uses `VITE_ORI_SETTLEMENT_MODE=live`; server still needs `ORI_1CLICK_JWT` (and optionally `ORI_HANDLE_DIRECTORY`) for live quotes. Changing secrets or recipients needs Bamio's OK.
- **1Click JWT:** the public API works without one but adds a 0.25% platform fee (docs: API Keys page). The code deliberately refuses live quotes without `ORI_1CLICK_JWT`. **Do not remove that guard without Bamio's fee decision.** ORI sets no `appFees` of its own.

## Open items (need Bamio)
- NEAR Auth: wait for Peersyst/NEAR reply (pending as of 09:20 WAT 6 Nov 2026); then decide wallet-creation build order.
- Per-swap fee figure — needs Bamio's approval before shipping.
- Bamio's NEAR account — still needed for a controlled real payment test.
- Making the repo public, signing any mainnet tx, posting or submitting — only with Bamio's explicit OK.


## Native wallet vault implementation (branch `native-wallet-vault`, 6 Nov 2026)
A first self-custody vault slice is now implemented in `app/src/nativeVault.ts` and exposed in `app/src/Wallets.tsx`:
- Generates a real secp256k1 EVM key/address and a Solana keypair in the browser.
- Encrypts both secret keys with PBKDF2-SHA256 (310,000 iterations) + AES-256-GCM before storing the encrypted vault record locally.
- Supports password unlock/lock, encrypted backup export (copy) and encrypted backup import.
- Verifies the decrypted keys reproduce the public addresses before unlocking or importing.
- Adds direct Noble crypto dependencies and vault lifecycle tests.

**Not yet complete / do not use with funds:** native EVM/Solana signing is not connected to Send, passkey/email recovery is not implemented, there is no cross-device account service, and no real wallet transaction has been tested. The Wallets screen explicitly warns users not to deposit to these addresses yet. This branch must pass CI and receive a code review before merge/deploy. Browser encryption is not a hardware wallet; a compromised page/device can expose keys while unlocked.
