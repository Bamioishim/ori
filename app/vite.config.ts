import react from '@vitejs/plugin-react'
import { defineConfig, type ProxyOptions } from 'vite'

// Solana's public RPC rejects browser Origins and publicnode needs a token for indexed calls
// (getTokenAccountsByOwner). For the prototype, the local dev/preview server forwards that one
// read-only call server-side without an Origin header. Production: use a keyed RPC (see PLAN.md).
const solProxy: Record<string, ProxyOptions> = {
  '/rpc/sol': { target: 'https://api.mainnet-beta.solana.com', changeOrigin: true, rewrite: () => '/', headers: { origin: '' },
    configure: p => p.on('proxyReq', r => { r.removeHeader('origin'); r.removeHeader('referer') }) },
}
export default defineConfig({
  plugins: [
    {
      name: 'near-auth-sdk-jsx-compat',
      transform(code, id) {
        if (!id.includes('/@fast-auth-near/react-sdk/') || !id.endsWith('fast-auth.provider.js')) return
        return code.replace('return <FastAuthContext.Provider value={contextValue}>{reactProvider(children)}</FastAuthContext.Provider>;', 'return React.createElement(FastAuthContext.Provider, { value: contextValue }, reactProvider(children));')
      },
    },
    react(),
  ],
  server: { proxy: solProxy },
  preview: { proxy: solProxy },
})
