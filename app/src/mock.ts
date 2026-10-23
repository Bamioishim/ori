// ⚠ EXAMPLE DATA ONLY — nothing here is a real wallet, price or balance.
export const EXAMPLE = true
export type Chain = 'Ethereum' | 'Solana' | 'Base' | 'NEAR'
export const chains: { name: Chain; usd: number; addr: string }[] = [
  { name: 'Base', usd: 1184.2, addr: '0x7a3…e91 (derived)' },
  { name: 'Solana', usd: 862.55, addr: '9xQe…4kP (derived)' },
  { name: 'Ethereum', usd: 540.1, addr: '0x51c…0d2 (derived)' },
  { name: 'NEAR', usd: 260.4, addr: 'example.near' },
]
export const assets = [
  { sym: 'USDC', chain: 'Base', amt: 1120.0, usd: 1120.0, d24: 0.0, role: 'Spend first' },
  { sym: 'SOL', chain: 'Solana', amt: 4.1, usd: 742.55, d24: 6.8, role: 'Held — trending up' },
  { sym: 'ETH', chain: 'Ethereum', amt: 0.21, usd: 503.4, d24: -1.2, role: 'Spendable' },
  { sym: 'NEAR', chain: 'NEAR', amt: 54.4, usd: 260.4, d24: 2.1, role: 'Gas abstracted' },
  { sym: 'USDT', chain: 'Solana', amt: 120.0, usd: 120.0, d24: 0.0, role: 'Spend first' },
  { sym: 'USDC', chain: 'Ethereum', amt: 36.7, usd: 36.7, d24: 0.0, role: 'Spend first' },
  { sym: 'ETH', chain: 'Base', amt: 0.027, usd: 64.2, d24: -1.2, role: 'Spendable' },
]
export const total = chains.reduce((a, c) => a + c.usd, 0)
export const protocols = [
  { name: 'Aave v3', chain: 'Base', apy: 4.6, cap: 40, alloc: 380, tvl: '$1.2B' },
  { name: 'Aave v3', chain: 'Ethereum', apy: 3.9, cap: 40, alloc: 0, tvl: '$9.8B' },
  { name: 'Kamino', chain: 'Solana', apy: 5.1, cap: 25, alloc: 120, tvl: '$410M' },
  { name: 'Rhea Lending', chain: 'NEAR', apy: 4.2, cap: 20, alloc: 0, tvl: '$90M' },
]
