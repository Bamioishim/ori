// Settlement-time data for 1Click quotes. Source: QuoteResponse.quote.timeEstimate, documented as
// "Estimated time in seconds for the swap to be executed after the deposit transaction is confirmed".
// It is NOT quote-generation latency. If the field is missing or invalid we show TIME_UNAVAILABLE, never a guess.
export const TIME_UNAVAILABLE = 'Time unavailable'
export const QUOTE_MAX_AGE_MS = 30_000

export function parseTimeEstimate(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 && n <= 7 * 24 * 3600 ? n : null
}

export function formatEta(eta: number | null | undefined): string {
  if (eta == null || !Number.isFinite(eta) || eta <= 0) return TIME_UNAVAILABLE
  if (eta < 90) return `~${Math.round(eta)}s`
  if (eta < 5400) return `~${Math.round(eta / 60)} min`
  return `~${(eta / 3600).toFixed(1)} h`
}

export const isQuoteStale = (at: string | undefined, now = Date.now(), maxAge = QUOTE_MAX_AGE_MS) => { const t = at ? Date.parse(at) : NaN; return !Number.isFinite(t) || now - t > maxAge }

// UI label: the provider's figure is a per-route estimate (it does not change with the amount), so say so.
export const etaLabel = (eta: number | null | undefined) => { const f = formatEta(eta); return f === TIME_UNAVAILABLE ? f : f + ' est.' }
