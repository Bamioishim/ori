// NEAR Auth SDK wiring (browser only). Loaded lazily so ORI never blocks startup on NEAR RPC or Auth0.
// Uses only the documented SDK: JavascriptProvider (Auth0), FastAuthClient/FastAuthSigner, near-api-js.
import { NEAR_AUTH, deriveWallet, relayerUrl, NO_RELAYER, accessKey, type NativeWallet } from './oriWallet'

type Sdk = {
  client: import('@fast-auth-near/react-sdk/dist/core').FastAuthClient<any>
  provider: import('@fast-auth-near/javascript-provider').JavascriptProvider
  nearApi: typeof import('near-api-js')
}
let loading: Promise<Sdk> | null = null
let ready: Sdk | null = null
export function loadNearAuth(): Promise<Sdk> {
  if (ready) return Promise.resolve(ready)
  if (!loading) loading = (async () => {
    // The SDK's view helper and near-api-js use Node's Buffer; browsers need the polyfill.
    const g = globalThis as unknown as { Buffer?: unknown; global?: unknown }
    if (!g.global) g.global = globalThis // some SDK dependencies reference Node's `global`
    if (!g.Buffer) g.Buffer = (await import('buffer')).Buffer
    const [{ JavascriptProvider }, core, nearApi] = await Promise.all([
      import('@fast-auth-near/javascript-provider'),
      import('@fast-auth-near/react-sdk/dist/core'),
      import('near-api-js'),
    ])
    const provider = new JavascriptProvider({ network: NEAR_AUTH.network, clientId: NEAR_AUTH.clientId, domain: NEAR_AUTH.domain, signingAudience: NEAR_AUTH.signingAudience })
    const { connection } = await nearApi.connect({ networkId: 'mainnet', nodeUrl: NEAR_AUTH.rpc })
    // relayerURL is only used by signAndSendTransaction / createAccount, which ORI never calls without a configured relayer.
    const client = new core.FastAuthClient(provider, connection, 'mainnet', relayerUrl() ?? 'https://relayer.invalid')
    ready = { client, provider, nearApi }
    return ready
  })().catch(e => { loading = null; throw e })
  return loading
}
export const nearAuthLoaded = () => ready

/** Must be called synchronously from a click so the Auth0 popup isn't blocked. Popup shows passkey + email on NEAR Auth's hosted screen. */
export async function loginPopup(forceSelectAccount = false): Promise<void> {
  const sdk = ready; if (!sdk) throw new Error('NEAR Auth is still loading. Try again in a moment.')
  await sdk.provider.login(undefined, forceSelectAccount)
}
export async function isLoggedIn(): Promise<boolean> { try { return await (await loadNearAuth()).client.isLoggedIn() } catch { return false } }
export async function logout() { const sdk = await loadNearAuth(); await sdk.provider.logout({ logoutParams: { returnTo: location.origin } } as any) }

/** After login: derive the NEAR key (MPC view) and every Chain Signatures receiving address. */
export async function deriveFromSession(): Promise<NativeWallet> {
  const sdk = await loadNearAuth()
  const signer = await sdk.client.getSigner()
  const authPath = await sdk.provider.getPath()
  const pk = await signer.getPublicKey('ed25519')
  return deriveWallet(authPath, pk.toString())
}

/** Step 1 (before the click): build the exact NEAR transfer and check identity. No popup, nothing signed. */
export type PreparedNear = { signer: any; transaction: any; to: string; yocto: bigint }
export async function prepareNearTransfer(w: NativeWallet, to: string, yocto: bigint): Promise<PreparedNear> {
  if (!relayerUrl()) throw new Error(NO_RELAYER)
  const sdk = await loadNearAuth()
  if (!(await sdk.client.isLoggedIn())) throw new Error('Sign in to your ORI wallet first.')
  const authPath = await sdk.provider.getPath()
  if (authPath !== w.authPath) throw new Error('You are signed in to NEAR Auth with a different login than this ORI wallet. Nothing was sent.')
  const signer = await sdk.client.getSigner()
  const pk = await signer.getPublicKey('ed25519')
  if (pk.toString() !== w.nearPublicKey) throw new Error('Derived key changed. Nothing was sent.')
  const { nonce, blockHash } = await accessKey(w.nearAccountId, w.nearPublicKey)
  const { transactions, utils } = sdk.nearApi
  const transaction = transactions.createTransaction(w.nearAccountId, pk as any, to, nonce + 1n, [transactions.transfer(yocto)], utils.serialize.base_decode(blockHash))
  return { signer, transaction, to, yocto }
}
/** Step 2 (inside the click): NEAR Auth approval popup → relayer submits `sign` to fast-auth.near → MPC signature → broadcast. */
export async function sendPreparedNear(p: PreparedNear): Promise<{ hash: string; status: 'confirmed' | 'failed' | 'pending' }> {
  if (!relayerUrl()) throw new Error(NO_RELAYER)
  const out: any = await p.signer.signAndSendTransaction({ transaction: p.transaction })
  const st = out?.status
  const status = st && typeof st === 'object' && 'SuccessValue' in st ? 'confirmed' : st && typeof st === 'object' && 'Failure' in st ? 'failed' : 'pending'
  return { hash: out?.transaction?.hash || out?.transaction_outcome?.id || '', status }
}
