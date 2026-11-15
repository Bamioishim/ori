# ORI

**A wallet and payment assistant exploring one balance across chains.**

ORI is a hackathon prototype built around a simple idea: people should be able to understand their assets and payment options without having to think about every chain detail.

> [!WARNING]
> **Prototype only. Not payment-ready.** No real payment or cross-chain settlement has been verified end to end on mainnet. Do not deposit funds or treat displayed example balances as real money. Spending limits are client-side and are not enforced on-chain.

## Try ORI

- **Main:** https://ori-bamioishim.vercel.app/
- **Alternate:** https://ori-blond-one.vercel.app/

You can continue as a Guest to explore clearly labelled example balances and simulated activity. Open **Wallets** to create or restore the built-in ORI wallet through NEAR Auth. The NEAR Auth hosted screen supports its configured sign-in methods. A successful login derives the user's NEAR account key and Chain Signatures receiving addresses.

Guest demo actions never submit a blockchain transaction. A guest balance is illustrative only. Watch-only mode reads public addresses and does not prove ownership.

## What is implemented

- **NEAR Auth:** ORI's mainnet client is configured. Users can sign in through the NEAR Auth hosted flow and restore the same wallet using the same Auth identity.
- **NEAR Chain Signatures address derivation:** ORI derives a NEAR implicit account plus EVM (Base/Ethereum) and Solana receiving addresses from the authenticated identity. These are receiving addresses, not proof that a transaction was signed.
- **NEAR RPC:** ORI can read a supplied NEAR account's native balance and supported NEAR USDC balance. These are read-only RPC checks.
- **NEAR Intents / 1Click integration:** ORI connects to the public token catalogue and quote flow for supported routes. Quotes are route estimates, not proof that a payment has settled.
- **Guest demo mode:** users can explore the product using clearly labelled example balances and simulated activity.
- **Watch-only portfolio mode:** users can inspect public addresses without granting signing permissions.

## What is not ready

- **No verified real payment or swap.** Do not describe the current build as payment-ready.
- **Built-in wallet sending:** receive addresses can be derived, but NEAR sending needs a funded signing relayer that is not configured. EVM and Solana sending from the built-in wallet are not wired. The built-in wallet is receive-only.
- **NEAR Intents settlement:** no real end-to-end payment or cross-chain settlement has been verified by the team. The deployment keeps settlement in preview mode.
- **Email login:** the separate Gmail-code profile flow is device-local; email delivery may be restricted by the current sender configuration.
- **On-chain spending policies:** current limits are browser-side UX controls, not smart-contract or backend enforcement.
- **NEAR AI Cloud / private inference:** not integrated. ORI does not currently use TEE-backed inference or verify AI attestations.
- **Privacy:** no privacy guarantee or private-AI claim is made. Public blockchain addresses and activity remain public.

## NEAR AI Cloud (optional)\n\nORI can route general assistant questions to NEAR AI Cloud when `NEARAI_API_KEY` is configured on the server. The server uses the official `@nearai/inference-sdk` Node client, requires model attestation, enables field-level E2EE, verifies the exact completion receipt, and only returns answers with a `provider_tee` signature. If attestation or signature verification fails, ORI discards the answer. No wallet balances, addresses, transaction history, or signing material are sent to this model endpoint. The local rule-based assistant remains the fallback when the key is absent.\n\nThis integration is not a substitute for transaction approval, wallet signing, or spending-policy enforcement.\n\n## NEAR components

| Component | Current status |
|---|---|
| NEAR Auth | Configured for ORI; hosted sign-in and wallet restoration are available for testing |
| NEAR Chain Signatures | Mainnet derived-address views for NEAR, EVM and Solana; no built-in-wallet send path |
| NEAR RPC | Read-only native NEAR and supported NEAR USDC balance checks |
| NEAR Intents 1Click | Token catalogue and quote integration; settlement not verified end to end |
| NEAR AI Cloud | Not integrated |
| On-chain spending policy | Not implemented |

## Architecture at a glance

- **Frontend:** React, Vite and TypeScript in `app/`.
- **NEAR Auth:** browser SDK using ORI's public client configuration; no client secret is shipped to the browser.
- **Chain Signatures:** read-only MPC derived-public-key views produce receiving addresses.
- **NEAR Intents:** server-side API routes proxy supported 1Click requests; the API credential stays server-side.
- **NEAR portfolio reads:** public RPC/view calls only.
- **Demo data:** local example data is clearly separate from live, read-only address data.

## Run locally

Requirements: Node.js 24 and npm.

```bash
cd app
npm install
npm run dev
npm run build
npm test
```

The Vite dev server serves the frontend. Vercel-style API routes under `app/api/` require a compatible runtime to exercise.

## Configuration

Copy `app/.env.example` for local development. Set secrets only in your deployment environment. Never commit API keys.

Important variables include:

| Variable | Purpose |
|---|---|
| `ORI_1CLICK_JWT` | Server-side NEAR Intents 1Click credential |
| `RESEND_API_KEY` | Email delivery for one-time login codes |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Durable storage and rate limiting for login codes |
| `ORI_AUTH_CODE_SECRET` | Server-side one-time-code protection |
| `VITE_ORI_NEAR_RELAYER_URL` | Optional signer relayer URL; unset means built-in wallet sending stays disabled |

## Submission scope

ORI demonstrates NEAR Auth onboarding and Chain Signatures-derived receiving addresses, NEAR Intents token/quote integration, and read-only NEAR balance checks. Guest demo mode remains available so judges can explore the interface without connecting a wallet. Planned and unavailable capabilities are labelled honestly rather than presented as shipped features.

ORI is not claiming private AI, TEE attestation, on-chain spending-policy enforcement, Chain Signatures-based transaction execution, or verified mainnet settlement.
