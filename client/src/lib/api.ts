const BASE = '/api'

export async function getSettings() {
  const res = await fetch(`${BASE}/settings`)
  return res.json()
}

export async function saveSettings(settings: Record<string, unknown>) {
  const res = await fetch(`${BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  })
  return res.json()
}

export async function uploadFile(file: File): Promise<{ jobId: string; specCount: number }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/jobs`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getJob(jobId: string) {
  const res = await fetch(`${BASE}/jobs/${jobId}`)
  return res.json()
}

export function getImageUrl(jobId: string, filename: string) {
  return `${BASE}/images/${jobId}/${filename}`
}

export function getDownloadUrl(jobId: string) {
  return `${BASE}/download/${jobId}`
}
