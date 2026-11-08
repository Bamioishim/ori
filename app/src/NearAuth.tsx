import { createContext, useContext, useEffect, useState } from 'react'
import { FastAuthProvider, useFastAuth, useIsLoggedIn, usePublicKey } from '@fast-auth-near/react-sdk'
import { JavascriptProvider } from '@fast-auth-near/javascript-provider'
import { connect } from 'near-api-js'

const NEAR_RPC = 'https://rpc.mainnet.near.org'
const NEAR_AUTH_CLIENT_ID = import.meta.env.VITE_NEAR_AUTH_CLIENT_ID || 'b6UA35Hea4utXEzCwwoTPnyikGiqwyiq'

const authProvider = new JavascriptProvider({ network: 'mainnet', clientId: NEAR_AUTH_CLIENT_ID, domain: 'login.auth.near.org', signingAudience: 'auth0.jwt.fast-auth.near' })

type AuthStatus = { ready: boolean; isLoggedIn: boolean; isLoading: boolean }
const NearAuthContext = createContext<AuthStatus>({ ready: false, isLoggedIn: false, isLoading: false })

export function useNearAuthStatus() {
  return useContext(NearAuthContext)
}

function AuthStatusBridge({ onStatus }: { onStatus: (status: AuthStatus) => void }) {
  const { isLoggedIn, isLoading } = useIsLoggedIn()
  useEffect(() => {
    onStatus({ ready: true, isLoggedIn: !!isLoggedIn, isLoading: !!isLoading })
  }, [isLoggedIn, isLoading, onStatus])
  return null
}

type Props = { children: React.ReactNode }

export default function NearAuthProvider({ children }: Props) {
  const [connection, setConnection] = useState<Awaited<ReturnType<typeof connect>>['connection'] | null>(null)
  const [status, setStatus] = useState<AuthStatus>({ ready: false, isLoggedIn: false, isLoading: false })

  useEffect(() => {
    let active = true
    connect({ networkId: 'mainnet', nodeUrl: NEAR_RPC })
      .then(({ connection: next }) => { if (active) setConnection(next) })
      .catch(error => console.warn('[ORI NEAR Auth unavailable]', error))
    return () => { active = false }
  }, [])

  // The wallet UI must never wait for a remote NEAR RPC just to mount.
  return <NearAuthContext.Provider value={status}>
    {connection
      ? <FastAuthProvider providerConfig={{ provider: authProvider }} connection={connection} network="mainnet">
          <AuthStatusBridge onStatus={setStatus} />
          {children}
        </FastAuthProvider>
      : children}
  </NearAuthContext.Provider>
}

export function NearAuthMenu() {
  const status = useNearAuthStatus()
  if (!status.ready) return <div className="near-auth-menu mono xs dim">NEAR AUTH · OFFLINE</div>
  return <ConnectedNearAuthMenu />
}

function ConnectedNearAuthMenu() {
  const { client, isReady } = useFastAuth()
  const { isLoggedIn, isLoading, error, refetch } = useIsLoggedIn()
  const { publicKey } = usePublicKey(undefined, false)
  const [busy, setBusy] = useState(false)
  const [loginError, setLoginError] = useState('')

  const login = async () => {
    if (!client) return
    setBusy(true); setLoginError('')
    try { await client.login() } catch (e) { setLoginError(e instanceof Error ? e.message : 'NEAR Auth could not send a verification code. Check the Auth provider configuration and try again.'); try { await refetch() } catch { /* retain the original login error */ } } finally { setBusy(false) }
  }
  const logout = async () => {
    if (!client) return
    setBusy(true)
    try { await client.logout() } finally { setBusy(false); await refetch() }
  }

  if (!isReady || isLoading) return <div className="near-auth-menu mono xs dim">NEAR AUTH · CHECKING…</div>
  if (!isLoggedIn) return <div className="near-auth-menu"><span className="dl"><b>NEAR Auth</b><small>Mainnet identity · Auth0</small>{(loginError || error?.message) && <small className="mono xs err">{loginError || error?.message}</small>}</span><button className="ghost compact" disabled={busy} onClick={login}>{busy ? 'Opening…' : 'Sign in'}</button></div>
  const key = publicKey?.toString() || 'Derived key available after authorization'
  return <div className="near-auth-menu"><span className="dl"><b>NEAR Auth · connected</b><small className="mono">{key.length > 24 ? `${key.slice(0, 12)}…${key.slice(-8)}` : key}</small></span><button className="ghost compact" disabled={busy} onClick={logout}>{busy ? 'Signing out…' : 'Sign out'}</button>{error && <small className="mono xs err">{error.message}</small>}</div>
}
