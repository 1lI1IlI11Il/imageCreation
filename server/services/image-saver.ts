import { promises as fs } from 'fs'
import path from 'path'
import JSZip from 'jszip'
import type { JobSpec } from '../types.ts'

const ensuredDirs = new Map<string, Promise<void>>()

export function getOutputDir(outputBase: string, jobId: string): string {
  return path.join(outputBase, jobId)
}

function ensureDir(dir: string): Promise<void> {
  const pending = ensuredDirs.get(dir)
  if (pending) return pending
  const created = fs.mkdir(dir, { recursive: true }).then(() => undefined)
  ensuredDirs.set(dir, created)
  return created
}

export async function saveImages(
  jobId: string,
  spec: JobSpec,
  buffers: Buffer[],
  outputBase: string
): Promise<string[]> {
  const dir = getOutputDir(outputBase, jobId)
  await ensureDir(dir)

  const safeLabel = spec.label.replace(/[^a-zA-Z0-9가-힣_-]/g, '-') || 'image'
  // Include rowIndex to prevent filename collisions when multiple rows share the same label
  const fileBase = `${safeLabel}-r${spec.rowIndex}`
  const filenames = buffers.map((_, index) => `${fileBase}-${index + 1}.png`)
  await Promise.all(
    filenames.map((filename, index) => fs.writeFile(path.join(dir, filename), buffers[index]))
  )
  return filenames.map((filename) => `${jobId}/${filename}`)
}

export async function listJobImages(outputBase: string, jobId: string): Promise<string[]> {
  const dir = getOutputDir(outputBase, jobId)
  try {
    const files = await fs.readdir(dir)
    return files
      .filter(f => f.endsWith('.png'))
      .map(f => path.join(dir, f))
  } catch {
    return []
  }
}

export async function createZipBuffer(filePaths: string[], _outputBase: string): Promise<Buffer> {
  const zip = new JSZip()
  const fileData = await Promise.all(filePaths.map((filePath) => fs.readFile(filePath)))
  filePaths.forEach((filePath, index) => {
    zip.file(path.basename(filePath), fileData[index])
  })
  return zip.generateAsync({ type: 'nodebuffer' }) as Promise<Buffer>
}
