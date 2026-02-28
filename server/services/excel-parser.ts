import * as XLSX from 'xlsx'
import type { JobSpec, StyleOption, MoodOption, AspectRatio, Settings } from '../types.ts'

const KNOWN_COLUMNS = ['prompt', 'style', 'mood', 'aspect_ratio', 'count', 'negative_prompt', 'seed', 'label']

function normalizeKey(k: string): string {
  return k.trim().toLowerCase().replace(/[\s\-]+/g, '_')
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    out[normalizeKey(k)] = v
  }
  return out
}

export function validateColumns(headers: string[]): { valid: boolean; warnings: string[] } {
  const warnings: string[] = []
  const valid = headers.includes('prompt')
  for (const h of headers) {
    if (!KNOWN_COLUMNS.includes(h)) warnings.push(`unknown column: ${h}`)
  }
  return { valid, warnings }
}

function parseWorkbook(wb: XLSX.WorkBook, defaults: Partial<Settings>): JobSpec[] {
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  if (rawRows.length === 0) return []

  const rows = rawRows.map(normalizeRow)

  const headers = Object.keys(rows[0])
  const { valid } = validateColumns(headers)
  if (!valid) throw new Error('prompt column is required. Found columns: ' + headers.join(', '))

  const specs: JobSpec[] = []
  const VALID_RATIOS: AspectRatio[] = ['1:1', '16:9', '9:16', '4:3', '3:4']

  for (const [rowIndex, row] of rows.slice(0, 500).entries()) {
    const get = (key: string) => {
      const v = row[key] ?? row[key.replace(/_/g, ' ')] ?? ''
      return String(v).trim()
    }

    const prompt = get('prompt')
    if (!prompt) continue

    const count = Math.min(Math.max(parseInt(get('count'), 10) || 1, 1), 4)
    const seedRaw = parseInt(get('seed'), 10)
    const rawRatio = get('aspect_ratio').replace(/;/g, ':')
    const aspectRatio = VALID_RATIOS.includes(rawRatio as AspectRatio)
      ? (rawRatio as AspectRatio)
      : (defaults.defaultAspectRatio || '1:1')

    const spec: JobSpec = {
      id: crypto.randomUUID(),
      rowIndex,
      prompt,
      style: (get('style') || defaults.defaultStyle || 'photorealistic') as StyleOption,
      mood: (get('mood') || defaults.defaultMood || 'neutral') as MoodOption,
      aspectRatio,
      count,
      negativePrompt: get('negative_prompt'),
      seed: Number.isNaN(seedRaw) ? undefined : seedRaw,
      label: get('label') || `image-${rowIndex}`,
    }

    specs.push(spec)
  }

  return specs
}

export function parseExcelBuffer(buffer: Buffer, defaults: Partial<Settings>): JobSpec[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  return parseWorkbook(wb, defaults)
}

export function parseCSVBuffer(buffer: Buffer, defaults: Partial<Settings>): JobSpec[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  return parseWorkbook(wb, defaults)
}
