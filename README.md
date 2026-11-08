# ORI — One private balance. Every chain.

![ORI](brand/og.png)

ORI is a non-custodial, multi-chain wallet project designed to make assets across Ethereum, Base, Solana and NEAR feel like one usable balance. It combines portfolio visibility, direct transfers, cross-chain payment routing and a conversational interface, with NEAR infrastructure as the foundation for cross-chain settlement and the longer-term account model.

> [!WARNING]
> **ORI is still under active development and is not audited or payment-ready.** The app can request real signatures from connected wallets, and live settlement routes can create real deposit instructions when correctly configured. Never connect a funded wallet or sign a transaction unless you have independently checked the exact network, asset, amount, recipient, fee and destination. No real end-to-end mainnet payment has been verified by the team. Spending policies currently live in the browser and are not enforced by a smart contract.
>
> The native wallet vault described below is an early implementation. Its EVM and Solana keys can be generated and encrypted locally, but native signing is not yet wired into Send. **Do not deposit funds into newly generated ORI vault addresses yet.**

**Preview:** https://ori-preview.vercel.app/  
**Active wallet work:** [PR #2 — encrypted native EVM + Solana wallet vault](https://github.com/Bamioishim/ori/pull/2)  
**Current development branch:** `native-wallet-vault`

---

## Contents

- [Why ORI exists](#why-ori-exists)
- [Product overview](#product-overview)
- [How ORI uses NEAR](#how-ori-uses-near)
- [Architecture](#architecture)
- [Wallet model and security](#wallet-model-and-security)
- [Feature and network support](#feature-and-network-support)
- [What is implemented today](#what-is-implemented-today)
- [Run locally](#run-locally)
- [Configuration](#configuration)
- [Tests and quality checks](#tests-and-quality-checks)
- [Repository map](#repository-map)
- [Limitations and security notes](#limitations-and-security-notes)
- [Roadmap — editable working plan](#roadmap--editable-working-plan)
- [Official NEAR references](#official-near-references)

---

## Why ORI exists

Crypto is fragmented. A person may hold USDC on Base, ETH on Ethereum, SOL on Solana and NEAR on NEAR. Paying someone can mean checking several wallets, finding the correct network, acquiring the right gas token, swapping an asset, bridging, and manually tracking whether the recipient actually received the money.

ORI's goal is to make the user's intent the starting point:

- **See** supported assets across multiple chains in one portfolio.
- **Choose** what to do in ordinary language or through a simple Send, Pay or Swap flow.
- **Route** a cross-chain payment through NEAR Intents when a conversion or chain change is needed.
- **Review** the exact asset, amount, route, destination and fees before signing.
- **Track** the transaction through a clear pending, completed, failed or refunded state.

The product principle is simple: users should choose what they want to achieve; ORI should explain the route and let the user approve the action. ORI must never silently spend funds because a chat message sounded like permission.

## Product overview

### Portfolio

ORI reads public balances for supported addresses and combines the results into a single portfolio view. It can read:

- ETH and USDC on Ethereum.
- ETH and USDC on Base.
- SOL and supported SPL stablecoins on Solana.
- NEAR and NEAR USDC for a supplied NEAR account.

Prices are sourced from the public NEAR Intents 1Click token catalogue. A token appearing in that catalogue does **not** mean ORI can sign or send it. The portfolio is read-only: reading an address never proves ownership and never grants permission to spend.

The interface also supports hidden-balance presentation and chain-level breakdowns.

### Wallets

ORI has two wallet paths:

1. **Native ORI vault (active development branch):** creates an EVM account and a Solana account directly in the browser. The secret material is encrypted locally with a password before it is persisted. The user can unlock, lock, export an encrypted backup and restore that backup.
2. **External wallets:** optional connections to compatible EVM wallets and Phantom. ORI stores public address/provider metadata; signing is performed by the wallet provider and must be approved by the user.

The native vault currently covers EVM and Solana only. It does not create a NEAR account, and its private keys are not yet connected to the transaction Send pipeline.

### Send

Send is intended for ordinary same-chain transfers. These do not need NEAR Intents:

- EVM transfers use the connected EIP-1193 wallet.
- Solana transfers use a connected Solana wallet.
- ORI validates the recipient format, estimates network fees, displays a review step, checks the selected account/network and then asks the wallet to sign.

A same-chain transfer should remain a normal transfer. ORI should not route it through a cross-chain solver unnecessarily.

### Pay and Swap

Pay and Swap use NEAR Intents when the user needs an asset conversion or a cross-chain delivery. ORI requests a quote, binds the quote to the review screen, asks the source wallet to sign the deposit transaction, then monitors the provider status.

A quote is not a payment. A deposit address is not proof of settlement. ORI should only show a cross-chain action as completed after the provider reports a terminal successful result.

### Requests and invoices

The Request flow currently creates a local request record with an amount, token, network, payee/recipient information, a copyable ORI link and a QR code. It is a useful request prototype, not a complete payment-request network: server persistence, notifications, recipient identity and automatic settlement still need work.

The longer-term invoice direction is to let a payee request a chosen asset while the payer pays from another supported asset, with NEAR Intents handling the conversion and ORI producing a receipt suitable for records.

### Hey ORI

The current assistant experience is a local rule-based interface, not a deployed LLM. It helps navigate and structure supported actions. It must ask for explicit user approval before any payment or swap.

Voice activation is intentionally user-initiated. There is no always-on microphone or wake-word listener.

---

## How ORI uses NEAR

NEAR is not just a logo in the interface. It is intended to provide the cross-chain settlement layer and, over time, the account and private-compute infrastructure behind ORI. The important distinction is between what is already connected and what remains a roadmap item.

### 1. NEAR Intents and the 1Click API — integrated, with end-to-end settlement still unverified

**Purpose:** let a user pay or swap across chains without manually choosing and operating a bridge.

ORI integrates with the NEAR Intents 1Click API at https://1click.chaindefuser.com/v0/.

Current integration:

- GET /v0/tokens supplies the public asset catalogue and token prices used by the app.
- Dry quotes (dry: true) provide a route preview, estimated output, provider fee/spread information and an estimated settlement time. A dry quote does not create a deposit address and cannot move funds.
- ORI's server API has a guarded non-dry quote route (POST /api/quote) and a status route (GET /api/status).
- The 1Click API credential is read only by the server from ORI_1CLICK_JWT. It is not exposed as a VITE_ browser variable.
- The server validates requested assets and routes against the trusted token catalogue before forwarding a quote request.
- The client binds the returned quote to the exact reviewed route, amount, recipient, refund address, minimum output and expiry before asking a wallet to sign.
- After a deposit is broadcast, ORI can poll the 1Click status endpoint and map states such as PENDING_DEPOSIT, PROCESSING, SUCCESS, REFUNDED and FAILED into the transaction history.

**What this does not mean:** the presence of quote and execution code does not prove a successful real mainnet settlement. The team has not completed a controlled end-to-end mainnet payment test. Routes without a supported source-wallet signer remain quote-only or disabled. Do not describe every token in the catalogue as spendable.

**Why this matters:** NEAR Intents abstracts solver coordination and cross-chain execution. ORI can focus on the user's requested outcome and the safety of the reviewed deposit rather than implementing a separate bridge for every chain pair.

### 2. NEAR RPC and NEAR assets — read-only portfolio support

ORI can read a supplied NEAR account through a NEAR-compatible RPC endpoint and query:

- Native NEAR account balance.
- NEAR USDC token balance through the token contract's ft_balance_of view method.

The current client uses a public FastNear RPC endpoint for these reads. The read path does not sign transactions, create an account or control the supplied NEAR account.

NEAR is also represented in the 1Click asset catalogue. This allows ORI to display NEAR-related routes and quote supported NEAR-origin or NEAR-destination paths where the provider offers them. A route remains non-executable unless ORI has a compatible signer and the required account/network checks.

**Current boundary:** NEAR can be added/read as an address, but native NEAR sending from ORI is not implemented.

### 3. NEAR Auth — production application submitted; integration pending

**Purpose:** provide a familiar sign-in experience (for example Google, Apple, email or passkey) that can resolve to a NEAR account without asking users to manage a traditional seed phrase.

ORI's production access application has been submitted to the NEAR Auth team. Approval/credentials are not the same thing as an integration.

As of this README's project status:

- The production application is pending.
- The NEAR Auth SDK/provider is not wired into the app.
- There is no completed NEAR Auth login callback/session flow in the current implementation.
- Gmail one-time-code endpoints exist, but production login remains fail-closed until a durable server store, session design and mail configuration are in place.
- NEAR Auth has not been connected to the local EVM/Solana vault or to transaction signing.

The intended use is to make account onboarding and recovery less intimidating. The actual wallet/key model, account permissions, recovery flow and transaction authorization still need a separate security design. NEAR Auth approval alone does not implement those pieces.

### 4. NEAR Chain Signatures — planned, not integrated

**Purpose:** allow a NEAR account or contract to request signatures for supported external-chain transactions through NEAR's MPC signer network.

The planned ORI model is to use a NEAR account as a coordinating identity and derive chain-specific accounts using explicit derivation paths. That could reduce the need for users to connect a separate wallet for every chain and could support an account abstraction experience across EVM and other supported networks.

Planned ORI work includes:

- Verify the current Chain Signatures network, signer contract and supported curves for each target chain.
- Design and test derivation paths and address ownership.
- Build a server/contract signing request flow with strict transaction intent validation.
- Verify returned signatures and broadcast only the exact reviewed transaction.
- Add spending policy, replay protection, expiry and recovery behavior.
- Test on testnet before any controlled mainnet use.

**Not implemented:** ORI does not currently call the Chain Signatures signer contract, derive user addresses with Chain Signatures or use Chain Signatures to sign EVM/Solana transactions. The EVM and Solana keys in the native vault are generated locally and are separate from NEAR MPC keys.

### 5. NEAR AI Cloud private inference — planned, not integrated

**Purpose:** give ORI a path to private AI reasoning for sensitive wallet context.

The intended use is to send only the minimum required context to a model running in a Trusted Execution Environment (TEE), for example:

- Parse a user's payment intent.
- Explain why a route was selected.
- Summarize a risk warning.
- Explain a transaction in plain language.

NEAR AI Cloud provides private inference infrastructure and attestation mechanisms. ORI would need to integrate the API, protect credentials, define what data can be sent, and verify the attestation according to the service's current documentation.

**Current reality:** the ORI assistant is local rule-based logic. It does not call NEAR AI Cloud, does not run an LLM, and does not currently verify TEE attestations. ORI must not claim private AI inference until that integration and verification exist.

### 6. NEAR access keys, meta-transactions and policy enforcement — planned

ORI's current spend limits are browser-side controls. They are useful UX guardrails, but they are not a security boundary: local browser storage can be changed and those limits do not govern a wallet used elsewhere.

The longer-term plan is to evaluate NEAR access keys, function-call permissions and meta-transaction patterns for limited, revocable automation. The design should make clear:

- Which contract methods an agent may call.
- Which assets and amounts are allowed.
- Daily and per-transaction limits.
- Expiry and revocation.
- Which actions still require an explicit user signature.
- What happens if the policy service or relayer is unavailable.

This is future work. No current ORI smart contract enforces the app's spending limits.

---

## Architecture

```text
                         ┌──────────────────────────┐
                         │       ORI web app        │
                         │     React + Vite + TS    │
                         └────────────┬─────────────┘
                                      │
          ┌───────────────────────────┼──────────────────────────┐
          │                           │                          │
          ▼                           ▼                          ▼
  Portfolio / RPC reads       Wallet authorization       ORI server API
  Ethereum · Base             Native local vault         /api/quote
  Solana · NEAR               EVM / Solana providers     /api/status
          │                           │                          │
          │                           │                          ▼
          │                           │                  NEAR Intents 1Click
          │                           │                  token catalogue
          │                           │                  quote / status
          │                           │                          │
          └───────────────────────────┴──────────────────────────┘
                                      │
                                      ▼
                             Transaction history
```

The current architecture separates three responsibilities:

1. **Read layer:** public RPC calls and the 1Click token catalogue provide balances, prices and route information.
2. **Authorization layer:** the connected wallet or (in the future) the native ORI signer authorizes the exact transaction. The native vault is not yet connected to Send.
3. **Settlement layer:** NEAR Intents 1Click coordinates cross-chain execution after the user deposits the reviewed source asset.

The 1Click JWT is server-only. Wallet private keys should never be placed in server environment variables or sent to ORI's API.

## Wallet model and security

### Native ORI vault (branch native-wallet-vault)

The current native vault implementation:

- Generates a secp256k1 EVM private key and derives its EVM address in the browser.
- Generates a Solana keypair in the browser.
- Encrypts the secret payload with PBKDF2-SHA256 (310,000 iterations) and AES-256-GCM.
- Stores the encrypted vault record in browser localStorage.
- Requires a vault password of at least 12 characters.
- Supports password unlock and lock.
- Supports export and import of an encrypted JSON backup.
- Checks that decrypted keys reproduce the stored public addresses.
- Clears the in-memory key byte arrays when locking, when the Wallets screen exits, and when the tab is backgrounded.

This is an early browser vault, not a hardware wallet. A compromised browser, malicious extension, injected script or compromised device can expose keys while the vault is unlocked. The encrypted backup still requires the password. Losing both the password and backup means losing access.

**Critical missing piece:** native EVM and Solana signing are not connected to the Send flow yet. The addresses are real key-derived addresses, but transaction signing, recovery and mainnet safety testing are incomplete. Do not fund them.

### External wallets

External wallet connections are optional. The EVM path uses an EIP-1193 provider; the Solana path uses a compatible Solana provider such as Phantom. ORI stores public address and provider metadata locally. The wallet provider controls the private key and asks the user to approve signatures.

### Data and privacy

- Public blockchain addresses and their transaction histories are public by design.
- Portfolio reads are read-only and do not prove ownership.
- Local profiles and current wallet metadata are device-local.
- The native vault stores encrypted key material locally; it does not create a cloud recovery copy.
- NEAR AI Cloud private inference and cryptographic attestation verification are not yet integrated.
- Separate addresses do not automatically make activity private or unlinkable. Privacy claims must be based on a tested design, not on address formatting.

---

## Feature and network support

| Capability | Ethereum | Base | Solana | NEAR |
|---|---:|---:|---:|---:|
| Read native balance | Yes | Yes | Yes | Yes |
| Read supported USDC balance | Yes | Yes | Yes | Yes |
| Read SOL / supported SPL assets | — | — | Yes | — |
| Direct Send with connected wallet | ETH, USDC | ETH, USDC | SOL, USDC, USDT | Not yet |
| Native ORI vault address | EVM address | Same EVM address | Solana address | Not yet |
| Native ORI vault signing | Not wired | Not wired | Not wired | Not available |
| NEAR Intents quote/catalogue | Route dependent | Route dependent | Route dependent | Route dependent |
| Verified real cross-chain settlement | Not yet | Not yet | Not yet | Not yet |

Support is deliberately narrower than the 1Click token catalogue. The catalogue can contain hundreds of assets and networks; ORI can only execute from a source for which it has a reviewed signer and transfer implementation.

## What is implemented today

The status below describes the active native-wallet-vault development branch. A draft pull request is open against native-wallets-mainnet; the native vault work has not yet been merged.

| Area | Current status |
|---|---|
| Mobile-first portfolio and wallet UI | Implemented |
| Public token catalogue and prices from 1Click | Integrated |
| Dry-run cross-chain quotes | Integrated |
| Server-side non-dry quote and status endpoints | Implemented behind server-only 1Click JWT; real settlement not end-to-end verified |
| Read-only Ethereum, Base, Solana and NEAR portfolio queries | Implemented for the supported assets |
| Direct Send from connected EVM/Solana wallets | Implemented for supported assets; not independently verified with real mainnet transactions |
| Local native EVM + Solana key generation and encrypted vault | Implemented on native-wallet-vault |
| Encrypted backup import/export and password unlock | Implemented on native-wallet-vault |
| Native vault signing in Send | Not implemented |
| NEAR native wallet creation or Send | Not implemented |
| NEAR Auth SDK and callback integration | Pending |
| NEAR Chain Signatures | Planned |
| NEAR AI Cloud private inference and attestation verification | Planned |
| Gmail code login | Endpoints exist; production blocked until durable storage/session/mail configuration |
| Server-backed payment requests and notifications | Planned |
| On-chain spending policies | Planned; current limits are browser-side only |
| Real end-to-end mainnet settlement test | Not completed |

---

## Run locally

**Requirements:** Node.js 24 or a compatible version supported by the project, plus npm.

```bash
git clone https://github.com/Bamioishim/ori.git
cd ori/app
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173.

Useful commands:

```bash
npm run dev       # Start Vite development server
npm run build     # TypeScript project check + Vite production build
npm run preview   # Preview the production build locally
npm run lint      # Oxlint
npm test          # Node test suite + click-activation check
npm run check:activation
```

The Vite dev server serves the frontend. It does not automatically run the Vercel API functions in app/api. To test /api/quote, /api/status or /api/auth/* locally, use a compatible Vercel development runtime and configure the server-only environment variables.

## Configuration

Copy app/.env.example and keep all real secrets out of Git.

| Variable | Scope | Purpose |
|---|---|---|
| VITE_ORI_SETTLEMENT_MODE | Browser build | preview keeps Pay/Swap in example mode; live enables the live settlement path |
| ORI_1CLICK_JWT | Server only | Authenticates ORI's requests to NEAR Intents 1Click |
| ORI_HANDLE_DIRECTORY | Server only | JSON allowlist mapping approved handles to verified recipient addresses |
| GMAIL_OAUTH_USER | Server only | Gmail sender identity |
| GMAIL_OAUTH_FROM | Server only | Email From header |
| GOOGLE_OAUTH_CLIENT_ID | Server only | Gmail OAuth2 client |
| GOOGLE_OAUTH_CLIENT_SECRET | Server only | Gmail OAuth2 secret |
| GMAIL_OAUTH_REFRESH_TOKEN | Server only | Gmail OAuth2 refresh token |
| ORI_AUTH_CODE_SECRET | Server only | Secret used by one-time email-code flow |

Never prefix a server secret with VITE_: Vite exposes VITE_ variables to browser code. Never commit .env, wallet keys, recovery phrases, JWTs or OAuth credentials.

## Tests and quality checks

Run from app/:

```bash
npm test
npm run lint
npm run build
```

The test suite includes unit coverage for transfer validation, quote binding, settlement states, spend limits, authentication-code behavior and native-vault lifecycle. Tests use mocked providers/RPCs where applicable.

Passing tests do **not** prove a real wallet signature, a successful mainnet transfer, a completed 1Click settlement, production email delivery, secure recovery or a mobile-browser experience. Those require separate controlled tests.

## Repository map

```text
.
├── README.md
├── PLAN.md
├── HANDOVER.md
├── brand/                    # Brand assets and social preview image
├── mascot/                   # ORI mascot artwork
├── shots/                    # Product and QA screenshots
└── app/
    ├── src/
    │   ├── App.tsx            # Main application and navigation
    │   ├── live.ts            # Token catalogue, RPC reads, quotes and wallet providers
    │   ├── nativeVault.ts     # Local EVM + Solana encrypted vault
    │   ├── wallets.ts         # External wallet connection metadata
    │   ├── Wallets.tsx        # Wallet and vault interface
    │   ├── transfers.ts       # Direct transfer validation and signing helpers
    │   ├── payExec.ts         # Pay flow
    │   ├── swapExec.ts        # Swap quote binding and execution
    │   ├── settings.ts        # Browser-side settings and spend controls
    │   └── config.ts          # Product name and screen visibility
    ├── api/
    │   ├── quote.ts           # Server-side 1Click quote request
    │   ├── status.ts          # 1Click settlement status
    │   ├── resolve.ts         # Verified handle resolution
    │   └── auth/              # Email-code authentication endpoints
    ├── tests/
    │   └── nativeVault.test.ts
    ├── public/
    ├── .env.example
    └── package.json
```

## Limitations and security notes

1. **Not audited.** ORI has not completed an independent security audit.
2. **Native vault signing is incomplete.** EVM and Solana keys can be generated and encrypted, but Send does not yet use them. Do not fund these addresses.
3. **No native NEAR wallet.** ORI can read a supplied NEAR account; it cannot currently create or sign from one.
4. **NEAR Auth is not integrated.** Production access is pending and the SDK/callback/session flow still needs implementation.
5. **NEAR Chain Signatures are not integrated.** ORI does not currently derive foreign addresses or request MPC signatures through NEAR.
6. **NEAR AI Cloud is not integrated.** The current assistant is local rule-based logic, not private inference.
7. **Cross-chain settlement is unverified.** Quotes and server endpoints exist, but the team has not completed a controlled successful mainnet settlement.
8. **Browser-side policy only.** Current limits can be changed by someone who controls the browser. They do not constrain a wallet outside ORI.
9. **Authentication is incomplete.** Email-code routes fail closed until durable one-time-code storage, signed sessions and mail delivery are configured.
10. **Privacy is limited.** Blockchain activity remains public. ORI does not currently provide unlinkable account aggregation or private AI.
11. **Mobile compatibility needs testing.** Speech and wallet-provider behavior vary across mobile browsers.

If you find a security issue, do not publish exploit details or include private keys in an issue. Contact the project owner privately.

---

## Roadmap — editable working plan

> This section is intentionally a working plan, not a promise that the features already exist. We can revise, reorder or remove it later.

### Phase 1 — Complete the native ORI wallet

- [x] Generate EVM and Solana keypairs locally.
- [x] Encrypt secret material with PBKDF2-SHA256 and AES-256-GCM.
- [x] Password unlock/lock and encrypted backup import/export.
- [ ] Integrate native EVM signing into Send.
- [ ] Integrate native Solana signing into Send.
- [ ] Add transaction simulation, fee estimation and signing-time account/chain checks for native keys.
- [ ] Add inactivity timeout and a reviewed session-security policy.
- [ ] Complete independent review of key handling and cryptographic integration.
- [ ] Run controlled low-value testnet transactions before considering any mainnet use.

### Phase 2 — NEAR account and authentication

- [ ] Complete NEAR Auth production approval and integrate the supported SDK.
- [ ] Implement the login callback, session lifecycle, logout and account linking.
- [ ] Decide how NEAR Auth identity relates to the local EVM/Solana vault.
- [ ] Implement a native NEAR account experience and NEAR transaction signing.
- [ ] Design secure recovery, device migration and account replacement before enabling recovery claims.
- [ ] Keep email login fail-closed until durable storage and session security are ready.

### Phase 3 — NEAR Chain Signatures and chain abstraction

- [ ] Validate current Chain Signatures support and signer contracts for each target chain.
- [ ] Prototype derivation and signing on testnet.
- [ ] Build a permissioned signing service with transaction-intent binding, expiry and replay protection.
- [ ] Decide whether Chain Signatures complements or replaces parts of the local EVM/Solana vault.
- [ ] Add more EVM networks and supported chains only after signer and transfer paths are tested.

### Phase 4 — NEAR Intents settlement

- [ ] Complete a controlled end-to-end 1Click payment with an approved source wallet and recipient.
- [ ] Test quote expiry, underpayment, refund, failure and delayed settlement states.
- [ ] Add robust retry, idempotency and user-facing recovery for interrupted deposits.
- [ ] Improve route selection using output amount, provider fee, slippage, time estimate and user preferences.
- [ ] Add payment receipts that explain the selected route and show verifiable transaction references.
- [ ] Keep quote-only assets clearly separated from assets ORI can actually sign.

### Phase 5 — Private and safer AI

- [ ] Integrate NEAR AI Cloud for selected assistant tasks.
- [ ] Verify the current TEE attestation flow before making privacy claims.
- [ ] Minimise prompt data and avoid sending private keys, recovery material or unnecessary portfolio details to any model.
- [ ] Build explainable scam/risk checks into the payment review.
- [ ] Keep AI as an assistant: it can prepare and explain actions, but user authorization remains explicit.

### Phase 6 — Policies, requests and everyday payments

- [ ] Move critical spending policies from browser-only storage into enforceable account/contract permissions.
- [ ] Add revocable, scoped permissions for automation with per-transaction and daily limits.
- [ ] Add server-backed payment requests, notifications and recipient verification.
- [ ] Build invoices with line items, chosen settlement asset and exportable receipts.
- [ ] Add contacts/handles only with a verified ownership and anti-impersonation process.
- [ ] Evaluate optional stablecoin yield only after protocol, custody, legal and emergency-exit reviews.

### Release gates

- [ ] Security review of wallet generation, encryption, signing and recovery.
- [ ] Testnet end-to-end tests for every supported chain.
- [ ] Controlled mainnet test with explicit owner approval and a low-value test amount.
- [ ] Verify monitoring, support, incident response and recovery procedures.
- [ ] Update the support matrix and README whenever implementation status changes.

---

## Official NEAR references

- [NEAR Intents documentation](https://docs.near-intents.org/)
- [1Click API integration guide](https://docs.near-intents.org/near-intents/integration/distribution-channels/1click-api)
- [NEAR Chain Signatures](https://docs.near.org/chain-abstraction/chain-signatures)
- [NEAR Auth](https://auth.near.org/)
- [NEAR AI Cloud documentation](https://docs.near.ai/)
- [NEAR AI Cloud private inference](https://docs.near.ai/cloud/private-inference)
- [NEAR access keys](https://docs.near.org/protocol/access-keys)
- [NEAR meta-transactions](https://docs.near.org/chain-abstraction/meta-transactions)

---

**ORI's direction:** one clear balance, understandable payments across chains, user-controlled authorization, and NEAR-powered settlement. The roadmap is intentionally visible and editable; the implementation status above is the source of truth for what works today.
