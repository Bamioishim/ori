# ORI Policy Vault (NEAR testnet prototype)

This contract is an isolated, testnet-first proof of on-chain policy enforcement. It is **not wired into the ORI production wallet** and must not be described as production custody or user-wallet spending enforcement.

## What it enforces on-chain

- Owner-only policy updates and transfers.
- Per-payment cap in yoctoNEAR.
- Daily aggregate cap, reset by NEAR block timestamp day.
- Optional recipient allowlist.
- Vault-balance check that preserves a storage reserve.
- One yoctoNEAR attached to privileged calls, so a function-call access key without an explicit deposit allowance cannot silently invoke them.

The contract holds NEAR in its own account. The owner deposits funds into the vault, and transfers are made from the vault balance. This is a **contract treasury model**, not a direct transfer from a user's existing implicit NEAR account.

## Build

Install Rust and the NEAR contract tools, then run:

```sh
cargo test --manifest-path contracts/ori-policy-vault/Cargo.toml
cargo near build non-reproducible-wasm --manifest-path contracts/ori-policy-vault/Cargo.toml
```

## Deploy only to testnet

Create a dedicated testnet account controlled by the project. Do not use a personal mainnet account or production funds. Deploy the generated WASM, initialize with the owner account and caps, then test:

1. A transfer below both caps succeeds.
2. A transfer above the per-payment cap fails.
3. Several individually valid transfers that exceed the daily cap fail at the boundary.
4. A non-owner cannot change policy or transfer.
5. A blocked recipient fails when the allowlist is enabled.
6. An underfunded vault refuses the transfer.

## Important limitations

- This first contract controls only NEAR held by the contract. It does not yet request EVM/Solana signatures from `v1.signer-prod.testnet`.
- Chain Signatures addresses derived for this contract account are different from addresses derived for a user's NEAR Auth implicit account. Never show the contract's addresses as the user's current ORI addresses.
- Failed asynchronous transfers are conservatively counted in the daily spend until the owner reviews the state. A production version needs a transfer receipt/callback state machine and recovery path.
- No audit, deployment, end-to-end testnet transaction, or production integration is claimed.
- Do not connect this contract to mainnet funds until independent review and testnet validation are complete.
