import type { JobSpec } from '../types.ts'

export function buildPrompt(spec: JobSpec): string {
  return `${spec.prompt}, ${spec.style} style, ${spec.mood} mood`
}

export async function generateImages(spec: JobSpec, apiKey: string): Promise<Buffer[]> {
  const prompt = buildPrompt(spec)

  // Primary: Imagen 4 (latest, verified working)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: spec.count,
            aspectRatio: spec.aspectRatio,
            negativePrompt: spec.negativePrompt || undefined,
            seed: spec.seed,
          },
        }),
      }
    )
    if (!res.ok) throw new Error(`Imagen 4 error ${res.status}: ${await res.text()}`)
    const data = await res.json() as { predictions: { bytesBase64Encoded: string }[] }
    return data.predictions.map(p => Buffer.from(p.bytesBase64Encoded, 'base64'))
  } catch (primaryError) {
    // Fallback: nano-banana-pro-preview (verified working)
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/nano-banana-pro-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      }
    )
    if (!res.ok) throw new Error(`nano-banana fallback error ${res.status}: ${await res.text()}`)
    const data = await res.json() as { candidates: { content: { parts: { inlineData?: { data: string } }[] } }[] }
    const buffers: Buffer[] = []
    for (const part of data.candidates[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) buffers.push(Buffer.from(part.inlineData.data, 'base64'))
    }
    if (buffers.length === 0) throw new Error('No images returned from nano-banana fallback')
    return buffers
  }
}

export async function generateWithRetry(spec: JobSpec, apiKey: string, maxAttempts = 3): Promise<Buffer[]> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await generateImages(spec, apiKey)
    } catch (e) {
      lastError = e
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
      }
    }
  }
  throw lastError
}
