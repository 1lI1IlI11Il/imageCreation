import { Hono } from 'hono'
import { homedir } from 'os'
import { promises as fs } from 'fs'
import path from 'path'
import type { Settings } from '../types.ts'

const CONFIG_PATH = path.join(homedir(), '.nano-batch', 'config.json')

const DEFAULTS: Settings = {
  apiKey: '',
  defaultStyle: 'photorealistic',
  defaultMood: 'neutral',
  defaultAspectRatio: '1:1',
  concurrency: 5,
  outputFolder: process.cwd() + '/output',
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8')
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true })
  await fs.writeFile(CONFIG_PATH, JSON.stringify(s, null, 2))
}

const app = new Hono()

app.get('/', async (c) => {
  const s = await loadSettings()
  const { apiKey, ...rest } = s
  return c.json({
    hasApiKey: apiKey.trim() !== '',
    ...rest,
  })
})

app.post('/', async (c) => {
  const body = await c.req.json<Partial<Settings> & { apiKey?: string }>()
  const current = await loadSettings()
  const newApiKey =
    body.apiKey && body.apiKey.trim() !== '' ? body.apiKey.trim() : current.apiKey
  const merged: Settings = {
    ...current,
    ...body,
    apiKey: newApiKey,
  }
  await saveSettings(merged)
  return c.json({ ok: true })
})

export default app
