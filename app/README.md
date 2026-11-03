# ORI (prototype)
Mobile-first front-end prototype. **All numbers are EXAMPLE DATA** (`src/mock.ts`). Read-only prices, dry-run quotes, watch-only balances, and GoPlus checks are live; payments and swaps remain simulated by default.

`npm i && npm run dev` · screens via `?screen=home|pay|swap|earn|privacy` · screenshots: `npm run build && npx vite preview --port 4317 & node shoot.mjs`

The first settlement slice now has a guarded Vercel API boundary in `api/quote.ts` and `api/status.ts`. The browser never receives the 1Click JWT. Set `ORI_1CLICK_JWT` only as a server-side deployment variable, and set `VITE_ORI_SETTLEMENT_MODE=live` only after a controlled recipient and wallet/deposit flow have been reviewed. The default `preview` mode cannot create a deposit address.

Copy `.env.example` when configuring a local environment. Never commit a real JWT or wallet key.

Name: `src/config.ts`. Accent colour: `--accent` in `src/index.css`.
