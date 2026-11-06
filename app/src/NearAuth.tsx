import { useEffect, useState } from 'react'
import { FastAuthProvider, useFastAuth, useIsLoggedIn, usePublicKey } from '@fast-auth-near/react-sdk'
import { JavascriptProvider } from '@fast-auth-near/javascript-provider'
import { connect } from 'near-api-js'

const NEAR_RPC = 'https://rpc.mainnet.near.org'
const NEAR_AUTH_CLIENT_ID = import.meta.env.VITE_NEAR_AUTH_CLIENT_ID || 'b6UA35Hea4utXEzCwwoTPnyikGiqwyiq'

const authProvider = new JavascriptProvider({ network: 'mainnet', clientId: NEAR_AUTH_CLIENT_ID, domain: 'login.auth.near.org', signingAudience: 'auth0.jwt.fast-auth.near' })

type Props = { children: React.ReactNode }

export default function NearAuthProvider({ children }: Props) {
  const [connection, setConnection] = useState<Awaited<ReturnType<typeof connect>>['connection'] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    connect({ networkId: 'mainnet', nodeUrl: NEAR_RPC })
      .then(({ connection: next }) => active && setConnection(next))
      .catch(() => active && setError('NEAR mainnet authentication is unavailable right now.'))
    return () => { active = false }
  }, [])

  if (!connection) return <div className="auth-loading">{error || 'Connecting to NEAR mainnet…'}</div>
  return <FastAuthProvider providerConfig={{ provider: authProvider }} connection={connection} network="mainnet">{children}</FastAuthProvider>
}

export function NearAuthMenu() {
  const { client, isReady } = useFastAuth()
  const { isLoggedIn, isLoading, error, refetch } = useIsLoggedIn()
  const { publicKey } = usePublicKey(undefined, false)
  const [busy, setBusy] = useState(false)

  const login = async () => {
    if (!client) return
    setBusy(true)
    try { await client.login() } catch { await refetch() } finally { setBusy(false) }
  }
  const logout = async () => {
    if (!client) return
    setBusy(true)
    try { await client.logout() } finally { setBusy(false); await refetch() }
  }

  if (!isReady || isLoading) return <div className="near-auth-menu mono xs dim">NEAR AUTH · CHECKING…</div>
  if (!isLoggedIn) return <div className="near-auth-menu"><span className="dl"><b>NEAR Auth</b><small>Mainnet identity · Auth0</small></span><button className="ghost compact" disabled={busy} onClick={login}>{busy ? 'Opening…' : 'Sign in'}</button></div>
  const key = publicKey?.toString() || 'Derived key available after authorization'
  return <div className="near-auth-menu"><span className="dl"><b>NEAR Auth · connected</b><small className="mono">{key.length > 24 ? `${key.slice(0, 12)}…${key.slice(-8)}` : key}</small></span><button className="ghost compact" disabled={busy} onClick={logout}>{busy ? 'Signing out…' : 'Sign out'}</button>{error && <small className="mono xs err">{error.message}</small>}</div>
}
