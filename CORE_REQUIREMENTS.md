# ORI core requirements (from Bamio, Nov 5 2026)

Canonical list of product requirements. Status is honest: DONE / PARTIAL / OPEN. See HANDOVER.md for blockers.

1. **Native Send & Receive** — every supported asset in the portfolio has direct Send and Receive to/from external blockchain wallets using real network addresses; the other side does not need ORI. Includes: copy address, paste address, network-aware address validation, network selection, fee estimates, transaction review, wallet authorization, transaction status and history.
   - NEAR Intents powers **cross-chain** operations only. Same-chain transfers are ordinary transfers (SOL → Solana wallet = normal Solana transaction; EVM → EVM = normal transfer). No cross-chain detour.
   - Unsupported signing must be shown as disabled, never as success.
   - Status: Home "Pay" tile is now **Receive** (real connected/added addresses only, copy, network select, preferred receiving currency) — DONE. Per-asset Send/Receive, paste/validation/fee/review for every network — OPEN. Direct Base USDC transfer exists; native SOL/ETH/NEAR transfers — OPEN.
2. **Gmail registration + emailed login code.** Status: PARTIAL. Code send/verify endpoints exist (Gmail OAuth2, server config unverified). Profiles are device-local; no cross-device restore without a server account store (architecture decision needed). Log out keeps the profile on the device for code sign-in and never touches wallets.
3. **Profile control on Home** replaces the EVM address above the portfolio (profile, account, log out) — DONE.
4. **Swaps on all actually supported chains/tokens**, discovered dynamically from the provider; a route is only executable when ORI can sign on that network. Status: OPEN.
5. **Fees:** no app-added fee (quote sets no `appFees`); show network/provider fee and output separately; same-chain uses direct transfer. No invented gas targets. The 1Click JWT stays server-side; the unauthenticated (+0.25%) fallback needs Bamio's decision. Status: PARTIAL.
6. **Quote settlement time** comes from `quote.timeEstimate` (seconds after deposit confirms); missing → "Time unavailable"; latest request wins; refresh every 30 s. Status: DONE (live response not re-traced: 1Click dry quotes were timing out on Nov 5).
7. **Spending-limit enforcement disclosure** — limits are checked in the ORI browser app only (cards + signing boundary, fail-closed); no backend, NEAR contract or Chain Signatures enforcement; external wallets are not governed. Status: DONE (disclosed + tests).
8. **Hey ORI is click activation only** (product doc v2). Status: DONE.
