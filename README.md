# ORI

**A wallet and payment assistant exploring one balance across chains.**

ORI is a hackathon prototype built around a simple idea: people should be able to understand their assets and payment options without having to think about every chain detail.

> [!WARNING]
> **Prototype only. Not payment-ready.** No real payment or cross-chain settlement has been verified end to end on mainnet. Do not deposit funds or treat displayed example balances as real money. Spending limits are client-side and are not enforced on-chain.

## Try the demo

**Open ORI:** https://ori.vercel.app/

For judges:
1. Open the app and continue as a **Guest**.
2. Use the **Example data** experience to explore the interface. The displayed balances and demo activity are fictional and do not represent funds.
3. You can also use **Watch-only** mode with a public address to inspect balances. Watch-only does not prove ownership and cannot sign or move funds.
4. Please do not rely on email login for judging. The current Resend setup only delivers codes to the account owner's inbox until a verified sending domain is configured. NEAR Auth wallet creation is also blocked while its callback URLs are awaiting allowlisting.

Guest demo actions never submit a blockchain transaction. A guest balance is illustrative only. Signing or moving funds is not part of the judge walkthrough.

## What is actually working

- **NEAR Intents / 1Click integration:** ORI connects to the public token catalogue and quote flow for supported routes. Quotes are route estimates, not proof that a payment has settled.
- **NEAR balance reads:** ORI can read a supplied NEAR account's native balance and supported NEAR USDC balance. These are read-only RPC checks.
- **Guest demo mode:** judges can explore the product using clearly labelled example balances and simulated activity.
- **Watch-only portfolio mode:** users can inspect public addresses without granting signing permissions.

The rest of the product is prototype UI or planned work. In particular, a real end-to-end NEAR Intents payment has **not** been verified by the team.

## What is not ready

- **No verified real payment or swap.** Do not describe the current build as payment-ready.
- **NEAR Auth:** production approval was received, but ORI's callback and web-origin URLs still need to be allowlisted by the NEAR Auth team. Judges should use Guest mode instead.
- **Email login:** Resend's current unverified-domain setup restricts delivery to the account owner's address. Other judges may not receive a code.
- **Chain Signatures:** not presented as a working transaction-signing feature in this submission.
- **NEAR AI Cloud / private inference:** not integrated. ORI does not currently use TEE-backed inference or verify AI attestations.
- **Privacy:** no privacy guarantee or private-AI claim is made. Public blockchain addresses and activity remain public.
- **Spending policies:** current limits are browser-side UX controls, not smart-contract or backend enforcement.
- **Native wallet sending:** not available as a verified, end-to-end capability.

## NEAR components

| Component | Current status |
|---|---|
| NEAR Intents 1Click | Token catalogue and quote integration; settlement not verified end to end |
| NEAR RPC | Read-only native NEAR and supported NEAR USDC balance checks |
| NEAR Auth | Approved, but callback allowlisting is still pending |
| Chain Signatures | Planned; not claimed as a working signing path |
| NEAR AI Cloud | Not integrated |
| On-chain spending policy | Not implemented |

## Architecture at a glance

- **Frontend:** React, Vite and TypeScript in `app/`.
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

## Submission scope

This submission leads with the two NEAR capabilities that are implemented: NEAR Intents token/quote integration and read-only NEAR balance checks. Guest demo mode is provided so judges can inspect the interface without needing a wallet or a working login. Planned items are labelled as planned rather than presented as shipped features.

ORI is not claiming private AI, TEE attestation, Chain Signatures-based transaction execution, or verified mainnet settlement.
