# Meridian — NEAR Hackathon build plan
Working name lives in `app/src/config.ts` (`APP_NAME`). Rename there only.
Concept: **One private balance across Ethereum, Solana, Base and NEAR. Pay or swap anything in one tap, no bridging.**
Rules: https://nearhackathon.com/HACKATHON.md — build 2026-11-01 00:00 → 2026-11-14 23:59 UTC (01:00 Nov 1 → 00:59 Nov 15 WAT). Repo public by deadline. Never commit secrets. Never sign mainnet txs, make repo public, post or submit without Bamio's explicit OK.

## Tracks
`defi` (NEAR Intents settlement, Chain Signatures), `realworld` (stablecoin pay-by-handle/phone/email), `privacy` (unlinkable addresses + TEE inference). Optional stretch: `security` (pre-payment scam check, function-call-key spending limits).

## Architecture
```
 Mobile web (Vite/React)  ──►  Meridian API (Node, TS)
                                 ├─ Account service: NEAR account + Chain Signatures-derived addrs (ETH/Base share EVM path?, SOL)
                                 ├─ Portfolio indexer: balances per derived address → one total (stored client-side encrypted)
                                 ├─ Route optimiser: spend-order policy → 1Click quotes → pick best
                                 ├─ Executor: NEAR Intents 1Click deposit → solver fills → dest chain
                                 ├─ Yield guard: whitelist, caps, depeg/TVL monitors, auto-exit
                                 ├─ Scam check: GoPlus token/address security (+ local blocklist)
                                 └─ Private AI: NEAR AI Cloud (TEE) for chat intent parsing + risk explanations
```
1. **Accounts.** One NEAR account per user (testnet in dev). Per-chain addresses derived with **Chain Signatures** (MPC signer contract, `v1.signer-prod.testnet` on testnet — verify in docs) using a *distinct derivation path per chain and per deposit* so addresses are not publicly linkable to each other. Docs: https://docs.near.org/chain-abstraction/chain-signatures
2. **Routing/settlement.** **NEAR Intents 1Click API** (`https://1click.chaindefuser.com/v0/…`; `/v0/tokens` verified live, returns assets+prices; `/v0/quote` gives a deposit address, solver fills to destination). JWT recommended (key needed, see below). Docs: https://docs.near-intents.org/ , https://docs.near-intents.org/near-intents/integration/distribution-channels/1click-api , overview https://docs.near.org/chain-abstraction/intents/overview
3. **Portfolio indexer.** Poll public RPCs per derived address (EVM: eth_getBalance + ERC20 balanceOf; Solana getTokenAccountsByOwner; NEAR view calls). Prices from `/v0/tokens`. Aggregation happens client-side/TEE so the server never holds the address→user map in plaintext.
4. **Route optimiser ("spends like cash").** Deterministic policy, explainable: (a) stablecoins first, prefer the one already on/near the destination; (b) skip assets with 24h momentum > +X% or user-pinned "hold"; (c) minimise fee+slippage across 1Click quotes for top 3 candidate sources; (d) split across sources if one is short. Output a "why" string (shown on Pay screen).
5. **Yield guard (opt-in, stables only).** Whitelist: Aave v3 (Ethereum, Base), Kamino (Solana), Rhea lending (NEAR) — confirm each. Per-protocol cap (e.g. ≤40%), keep-liquid floor. Monitors: stable price < $0.995 (depeg) or protocol TVL −20%/24h (DefiLlama `https://yields.llama.fi/pools`, verified live) ⇒ auto-exit to wallet. Spend pulls from yield in the same flow. **Hackathon: testnet/simulated only** — real deposits need audited contracts and legal review.
6. **Privacy.** Unlinkable derived addresses; fresh deposit address per incoming payment; balances aggregated locally (encrypted IndexedDB) or inside **NEAR AI Cloud private inference (TEE, attestation verifiable)**: https://docs.near.ai/ , https://docs.near.ai/cloud/private-inference . Honest limit: on-chain amounts are still public per address; we hide *linkage and total*, not individual tx.
7. **Scam check.** Before every pay/swap: GoPlus token security + malicious address API (`api.gopluslabs.io/api/v1/token_security/{chainId}` verified live; docs https://docs.gopluslabs.io/), plus our blocklist and "new contract / unverified" heuristics. Block on high risk; warn on medium.
8. **Limits / pay-by-handle.** Function-call access keys for capped spending (https://docs.near.org/protocol/access-keys); meta-transactions to abstract gas (https://docs.near.org/chain-abstraction/meta-transactions). Handle/phone/email → claim link escrow on NEAR; recipient claims to any chain.

## 14-day schedule (Nov 1–14)
| Day | Work |
|---|---|
| 1 | Repo from this prototype, CI, env template, testnet NEAR account (Bamio creates), read 1Click + Chain Sig docs end-to-end |
| 2 | Chain Signatures: derive EVM/Base/SOL addresses, sign a testnet EVM tx |
| 3 | Portfolio indexer for 4 chains + prices from `/v0/tokens` |
| 4 | Home wired to live (testnet) data; hidden-balance mode |
| 5 | 1Click quote + status integration; Swap screen live (smallest amounts, testnet or dry-run) |
| 6 | Route optimiser + "why" explanation; unit tests |
| 7 | Pay flow; pay-by-handle claim-link contract (testnet) |
| 8 | Scam check (GoPlus + blocklist), blocking UI |
| 9 | Yield guard: whitelist, caps, monitors (simulated positions), auto-exit job |
| 10 | Privacy: per-payment addresses, local encrypted aggregation; NEAR AI Cloud TEE call for chat/risk text |
| 11 | Spending-limit function-call keys; polish motion/theme |
| 12 | README for AI judges, e2e Playwright test, seeded demo mode |
| 13 | Record demo video; Bamio reviews |
| 14 | Bamio's OK → repo public, X post (Bamio posts), submission payload printed for his yes |

## Demo video script (~90s)
1. 0–10s: "My money is on 4 chains. Paying someone means bridging, gas tokens, praying." Show 4 wallet apps.
2. 10–25s: Open Meridian. One number, dust visual, chain breakdown. Toggle hide balance.
3. 25–50s: Pay "@tolu $50". Route card: USDC from Base, SOL kept because it's up. Scam check turns clean. Hold to pay; status → arrived on Solana.
4. 50–60s: Paste a known drainer address → blocked, with reason.
5. 60–75s: Earn: opt in, floor $100, whitelist, simulate depeg → auto-exit.
6. 75–85s: Privacy: "what the public sees" — no linked owner, no total.
7. 85–90s: "Built at NEAR HACKATHON with NEAR Intents + Chain Signatures + NEAR AI Cloud."

## README outline (for AI judges)
1. What it is (2 lines) · Problem · Tracks + NEAR features used (with file paths)
2. Quick start: `cp .env.example .env` → `npm i` → `npm run dev` → open http://localhost:5173
3. "Do X → see Y" test steps: Home shows total; Pay @tolu 50 → route card + scam check CLEAN; paste blocklisted address → BLOCKED; Earn → simulate depeg → funds exit; Privacy → public view shows no linkage
4. `npm test` (unit: optimiser, yield guard; e2e Playwright)
5. Architecture diagram · what is live vs simulated (honest) · env vars list · limitations

## Keys / accounts needed
- 1Click JWT (optional but recommended; request via NEAR Intents docs/partners form)
- NEAR AI Cloud API key (private inference) — maybe credits in NEAR Discord after Nov 1
- GoPlus: works keyless at low rate; key for higher limits
- RPCs: public endpoints OK; Alchemy/Helius keys optional
- Testnet NEAR account (Bamio creates). Mainnet payout account for submission (Bamio creates).

## Open questions / risks
- Is 1Click usable on testnet? It is mainnet-oriented; we may need a dry-run/quote-only mode for the demo and tiny mainnet amounts only with Bamio's explicit OK.
- Chain Signatures derivation for Solana (ed25519) — confirm current support/path in docs.
- Privacy claim must stay honest: per-address amounts are public on-chain.
- Auto-yield = custody/regulatory risk; keep it simulated + opt-in for hackathon.
- "One balance" is a crowded category → edge = spend-order intelligence + privacy + scam blocking; lead the demo with those.
- Final name + accent colour pending (accent is one CSS var `--accent`, currently temporary warm off-white).
