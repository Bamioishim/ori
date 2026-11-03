import { json, oneClick } from './_oneclick.js'

export default async function handler(request: Request) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405)
  const url = new URL(request.url)
  const depositAddress = url.searchParams.get('depositAddress')?.trim()
  const depositMemo = url.searchParams.get('depositMemo')?.trim()
  if (!depositAddress) return json({ error: 'depositAddress is required.' }, 400)
  const params = new URLSearchParams({ depositAddress })
  if (depositMemo) params.set('depositMemo', depositMemo)
  return oneClick('/status?' + params.toString(), { method: 'GET' })
}
