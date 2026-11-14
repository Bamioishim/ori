# Token logo source

ORI uses the maintained Trust Wallet assets repository for core token icons:

- Repository: https://github.com/trustwallet/assets
- Logos: https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/

Current mappings live in `app/src/tokenLogos.ts` for USDC, USDT, ETH, SOL, NEAR, and Base. `CHAIN_LOGOS` maps Ethereum, Base, Solana, and NEAR to those same Trust Wallet files so Profile chain chips match Home token glyphs (ETH/SOL/NEAR) and the official Base chain logo. ETH, SOL, and NEAR keep their existing inline vector fallback if the remote image fails; Base has no invented fallback mark.
