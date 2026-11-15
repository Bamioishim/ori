import { NativeWalletCard } from './NativeWallet'

export default function WalletsScreen() {
  return <div className="pg wallets-page">
    <section className="pad-top">
      <div className="label">ORI WALLET · NEAR AUTH</div>
      <h2 className="big2">One built-in wallet,<br /><span className="dim">across your chains.</span></h2>
      <p className="account-copy">Create or restore your ORI wallet with NEAR Auth. ORI derives your NEAR, EVM and Solana receiving addresses using NEAR Chain Signatures. No MetaMask, Phantom or external wallet connection is required.</p>
    </section>
    <NativeWalletCard />
  </div>
}
