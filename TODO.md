# ORI implementation TODO

## Guarded 1Click settlement boundary

- [x] Add a server-only 1Click quote endpoint that keeps the JWT out of the browser.
- [x] Validate supported assets, destination/refund addresses, amount, and deadline before forwarding requests.
- [x] Add a server-only status endpoint that proxies deposit-address status polling.
- [x] Add typed browser helpers for creating a live quote and polling settlement status.
- [x] Keep the existing dry-run quote path unchanged by default.
- [ ] Connect the payment confirmation sheet to the live quote flow behind an explicit feature flag.
- [ ] Add wallet signing/deposit support for the selected origin chain.
- [ ] Render deposit address, status transitions, transaction hashes, and refund/failure states in the receipt.
- [ ] Add unit and e2e coverage for quote validation and settlement state transitions.
- [ ] Configure `ORI_1CLICK_JWT` and a controlled recipient before enabling live mode.

## Native wallet vault

- [x] Generate EVM + Solana keypairs locally in the browser.
- [x] Encrypt secret material with PBKDF2-SHA256 + AES-256-GCM before persistence.
- [x] Add password unlock and encrypted backup import/export.
- [x] Add address/key consistency checks and vault lifecycle tests.
- [ ] Integrate native EVM and Solana signing into the existing Send flow.
- [ ] Add inactivity/background auto-lock and reviewed session policy.
- [ ] Add passkey-based unlock and a secure recovery design; Gmail code login is not wallet recovery.
- [ ] Run CI, review the cryptography integration, and test on-chain with controlled low-value wallets before enabling deposits.

## Current status pointer (6 Nov 2026)

- Runtime adapter fixed at `6bf4ff8` — see README / HANDOVER.
- ORI-created wallets: **PARTIAL** on branch `native-wallet-vault` (encrypted local EVM + Solana key vault); native signing and passkey/email recovery remain open. Do not deposit funds to the generated addresses yet.
- NEAR Auth production application: **pending** (no reply as of 09:20 WAT 6 Nov 2026). Approval ≠ implementation.
- Not payment-ready; limits are browser-side only.
