import { StrictMode, Component, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import NearAuthProvider from './NearAuth.tsx'

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null }

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ORI render error]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return <main style={{ minHeight: '100vh', background: '#080808', color: '#f5f4f1', padding: 24, fontFamily: 'monospace' }}>
        <p style={{ color: '#ff8a8a' }}>ORI COULD NOT START</p>
        <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{this.state.error}</p>
        <p style={{ color: '#999', fontSize: 12 }}>Reload the page after sharing this error with the ORI developer.</p>
      </main>
    }
    return this.props.children
  }
}

window.addEventListener('error', event => {
  console.error('[ORI window error]', event.message, event.error)
})
window.addEventListener('unhandledrejection', event => {
  console.error('[ORI unhandled rejection]', event.reason)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <NearAuthProvider>
        <App />
      </NearAuthProvider>
    </AppErrorBoundary>
  </StrictMode>,
)
