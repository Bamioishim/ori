const TRUST = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains'
export const TOKEN_LOGOS: Record<string, string> = {
  USDC: `${TRUST}/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png`,
  USDT: `${TRUST}/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png`,
  ETH: `${TRUST}/ethereum/info/logo.png`,
  SOL: `${TRUST}/solana/info/logo.png`,
  NEAR: `${TRUST}/near/info/logo.png`,
  BASE: `${TRUST}/base/info/logo.png`,
}
// Chain rows reuse the same Trust Wallet files as Home token glyphs (ETH/SOL/NEAR)
// plus the official Trust Wallet Base chain logo. No generated marks.
export const CHAIN_LOGOS: Record<string, string> = {
  Ethereum: TOKEN_LOGOS.ETH,
  Base: TOKEN_LOGOS.BASE,
  Solana: TOKEN_LOGOS.SOL,
  NEAR: TOKEN_LOGOS.NEAR,
}
