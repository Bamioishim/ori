# ORI (prototype)
Mobile-first front-end prototype. **All numbers are EXAMPLE DATA** (`src/mock.ts`). Read-only prices, dry-run quotes, watch-only balances, and GoPlus checks are live; payments and swaps remain simulated by default.

`npm i && npm run dev` · screens via `?screen=home|pay|swap|earn|privacy` · screenshots: `npm run build && npx vite preview --port 4317 & node shoot.mjs`

The first settlement slice now has a guarded Vercel API boundary in `api/quote.ts` and `api/status.ts`. The browser never receives the 1Click JWT. Set `ORI_1CLICK_JWT` only as a server-side deployment variable, and set `VITE_ORI_SETTLEMENT_MODE=live` only after a controlled recipient and wallet/deposit flow have been reviewed. The default `preview` mode cannot create a deposit address.

Copy `.env.example` when configuring a local environment. Never commit a real JWT, wallet key, or mail-provider secret.

Account recovery uses a short-lived Gmail code through the server-only `/api/auth/send-code` and `/api/auth/verify-code` routes. Delivery prefers Resend when `RESEND_API_KEY` is set (`RESEND_FROM_EMAIL` defaults to `ORI <onboarding@resend.dev>`), and otherwise uses Gmail SMTP XOAUTH2 through server-only `GMAIL_OAUTH_USER`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GMAIL_OAUTH_REFRESH_TOKEN`, and `GMAIL_OAUTH_FROM`. `ORI_AUTH_CODE_SECRET` signs the one-time challenge. The current browser profile is restored only when the verified Gmail matches its saved local ORI profile; a shared account database is still required for cross-device restoration.

The Request screen creates a local payment-request record with amount, token, network, handle/address, a copyable `ori://` link, and QR code. It is intentionally a preview slice: requests are not yet server-backed, delivered as notifications, or settled automatically.

The microphone control explicitly requests `getUserMedia` access before starting Web Speech recognition. If the browser previously blocked access, allow Microphone for the site in browser permissions and tap the control again. Core token rows use maintained Trust Wallet asset logos with local vector fallbacks.

Name: `src/config.ts`. Accent colour: `--accent` in `src/index.css`.
