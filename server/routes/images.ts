import { Hono } from 'hono'
import { promises as fs } from 'fs'
import path from 'path'
import { loadSettings } from './settings.ts'
import { listJobImages, createZipBuffer } from '../services/image-saver.ts'

const app = new Hono()

app.get('/images/:jobId/:filename', async (c) => {
  const settings = await loadSettings()
  const filePath = path.join(settings.outputFolder, c.req.param('jobId'), c.req.param('filename'))
  try {
    const data = await fs.readFile(filePath)
    return new Response(data, { headers: { 'Content-Type': 'image/png' } })
  } catch {
    return c.json({ error: 'not found' }, 404)
  }
})

app.get('/download/:jobId', async (c) => {
  const settings = await loadSettings()
  const jobId = c.req.param('jobId')
  const files = await listJobImages(settings.outputFolder, jobId)
  const zip = await createZipBuffer(files, settings.outputFolder)
  return new Response(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="nano-batch-${jobId}.zip"`,
    },
  })
})

export default app
