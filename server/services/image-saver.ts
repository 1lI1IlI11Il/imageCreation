import { promises as fs } from 'fs'
import path from 'path'
import JSZip from 'jszip'
import type { JobSpec } from '../types.ts'

export function getOutputDir(outputBase: string, jobId: string): string {
  return path.join(outputBase, jobId)
}

export async function saveImages(
  jobId: string,
  spec: JobSpec,
  buffers: Buffer[],
  outputBase: string
): Promise<string[]> {
  const dir = getOutputDir(outputBase, jobId)
  await fs.mkdir(dir, { recursive: true })

  const safeLabel = spec.label.replace(/[^a-zA-Z0-9가-힣_-]/g, '-') || 'image'
  // Include rowIndex to prevent filename collisions when multiple rows share the same label
  const fileBase = `${safeLabel}-r${spec.rowIndex}`
  const paths: string[] = []

  for (let i = 0; i < buffers.length; i++) {
    const filename = `${fileBase}-${i + 1}.png`
    await fs.writeFile(path.join(dir, filename), buffers[i])
    paths.push(`${jobId}/${filename}`)

  }

  return paths
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
  for (const filePath of filePaths) {
    const data = await fs.readFile(filePath)
    zip.file(path.basename(filePath), data)
  }
  return zip.generateAsync({ type: 'nodebuffer' }) as Promise<Buffer>
}
