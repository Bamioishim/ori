import { InferenceClient } from '@nearai/inference-sdk/node'
import { adapt } from './_runtime.js'

declare const process: { env: Record<string, string | undefined> }

const MODEL = () => process.env.NEARAI_MODEL?.trim() || 'z-ai/glm-5.3-flash'
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
})

async function webHandler(request: Request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const apiKey = process.env.NEARAI_API_KEY
  if (!apiKey) return json({ error: 'NEAR AI Cloud is not configured on this deployment.' }, 503)

  let body: unknown
  try { body = await request.json() } catch { return json({ error: 'Invalid JSON body.' }, 400) }
  const prompt = body && typeof body === 'object' && 'prompt' in body ? String((body as { prompt: unknown }).prompt ?? '').trim() : ''
  if (!prompt || prompt.length > 2000) return json({ error: 'Prompt must contain 1–2000 characters.' }, 400)

  const model = MODEL()
  try {
    // Node client verifies Gateway TLS + deployment attestation before inference.
    // E2EE requires an attested model; Incognito/Gateway-only models are rejected.
    const client = new InferenceClient({
      apiKey,
      e2ee: true,
      attestationCacheTimeToLiveMs: 0,
      responseCacheTimeToLiveMs: 5 * 60 * 1000,
    })
    const deployment = await client.verify(model)
    if (!deployment.models?.length) return json({ error: 'NEAR AI returned no model TEE attestation. No answer was generated.' }, 502)

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are ORI, a helpful wallet and payments assistant. Answer general questions clearly. Never claim to have checked a balance, executed a transaction, changed a wallet, or enforced a spending policy. Never ask for seed phrases, private keys, passwords, or authentication codes. Do not initiate or authorize transactions; ORI handles those through separate explicit confirmation flows.' },
        { role: 'user', content: prompt },
      ],
    })
    // Do not return model output until its exact request/response signature is verified.
    const receipt = await client.verifyResponse(completion.id)
    if (receipt.signatureKind !== 'provider_tee') {
      return json({ error: 'The response was not signed by the attested model TEE. ORI discarded it.' }, 502)
    }
    const content = completion.choices?.[0]?.message?.content
    const answer = typeof content === 'string' ? content : Array.isArray(content) ? content.map((p: any) => p?.text || '').join('') : ''
    if (!answer.trim()) return json({ error: 'NEAR AI returned an empty response.' }, 502)
    return json({
      answer,
      proof: {
        verified: true,
        signatureKind: receipt.signatureKind,
        model,
        verifiedAt: new Date().toISOString(),
        modelAttestations: deployment.models.length,
      },
    })
  } catch (error) {
    // Fail closed: never fall back to an unverified completion from this endpoint.
    const message = error instanceof Error ? error.message : 'Verification failed.'
    return json({ error: 'NEAR AI attestation, inference, or response verification failed. No unverified answer was returned.', detail: message.slice(0, 240) }, 502)
  }
}

export default adapt(webHandler)
