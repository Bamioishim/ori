# Token logo source

ORI uses the maintained Trust Wallet assets repository for core token icons:

- Repository: https://github.com/trustwallet/assets
- Logos: https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/

Current mappings live in `app/src/tokenLogos.ts` for USDC, USDT, ETH, SOL, and NEAR. Each image has an inline fallback vector mark if the remote asset is unavailable.
