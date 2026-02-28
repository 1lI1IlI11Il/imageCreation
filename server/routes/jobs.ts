import { Hono } from 'hono'
import { parseExcelBuffer, parseCSVBuffer } from '../services/excel-parser.ts'
import { generateWithRetry } from '../services/gemini.ts'
import { saveImages } from '../services/image-saver.ts'
import { loadSettings } from './settings.ts'
import type { BatchJob, JobResult, JobSpec, Settings } from '../types.ts'

const jobs = new Map<string, BatchJob>()
export const wsClients = new Set<{ send: (data: string) => void }>()

function broadcast(data: object) {
  const msg = JSON.stringify(data)
  wsClients.forEach(ws => { try { ws.send(msg) } catch { wsClients.delete(ws) } })
}

function serializeResult(r: JobResult) {
  return {
    spec: r.spec,
    status: r.status,
    images: r.images,
    error: r.error,
    attempts: r.attempts,
  }
}

async function processJob(job: BatchJob, spec: JobSpec, settings: Settings) {
  const result = job.results.get(spec.id)!
  result.status = 'running'
  result.startedAt = Date.now()
  broadcast({ type: 'job_update', jobId: job.id, result: serializeResult(result) })

  try {
    const buffers = await generateWithRetry(spec, settings.apiKey)
    const paths = await saveImages(job.id, spec, buffers, settings.outputFolder)
    result.status = 'done'
    result.images = paths
    result.completedAt = Date.now()
  } catch (e: unknown) {
    result.status = 'failed'
    result.error = e instanceof Error ? e.message : String(e)
  }
  result.attempts++
  broadcast({ type: 'job_update', jobId: job.id, result: serializeResult(result) })
}

function resolveFinalStatus(job: BatchJob): BatchJob['status'] {
  const values = [...job.results.values()]
  return values.some((r) => r.status === 'failed') ? 'partial' : 'done'
}

async function runBatch(job: BatchJob, settings: Settings) {
  const specs = job.specs
  const workerCount = Math.max(1, Math.min(settings.concurrency, specs.length))
  const workers = Array.from({ length: workerCount }, (_, workerIndex) => (async () => {
    for (let index = workerIndex; index < specs.length; index += workerCount) {
      await processJob(job, specs[index], settings)
    }
  })())

  await Promise.all(workers)
  job.status = resolveFinalStatus(job)
  broadcast({ type: 'batch_done', jobId: job.id, status: job.status })
}

function runBatchInBackground(job: BatchJob, settings: Settings) {
  void runBatch(job, settings).catch((error: unknown) => {
    job.status = 'partial'
    broadcast({
      type: 'batch_error',
      jobId: job.id,
      error: error instanceof Error ? error.message : String(error),
    })
    for (const result of job.results.values()) {
      if (result.status === 'pending' || result.status === 'running') {
        result.status = 'failed'
        result.error = 'Batch interrupted'
        result.completedAt = Date.now()
        result.attempts++
        broadcast({ type: 'job_update', jobId: job.id, result: serializeResult(result) })
      }
    }
    broadcast({ type: 'batch_done', jobId: job.id, status: job.status })
  })
}

const app = new Hono()

app.post('/jobs', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  if (!file) return c.json({ error: 'no file uploaded' }, 400)

  const buffer = Buffer.from(await file.arrayBuffer())
  const settings = await loadSettings()
  const ext = file.name.split('.').pop()?.toLowerCase()

  let specs: JobSpec[]
  try {
    specs = ext === 'csv'
      ? parseCSVBuffer(buffer, settings)
      : parseExcelBuffer(buffer, settings)
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : 'parse error' }, 400)
  }

  const jobId = crypto.randomUUID()
  const job: BatchJob = {
    id: jobId,
    createdAt: Date.now(),
    specs,
    results: new Map(specs.map(s => [s.id, { spec: s, status: 'pending', images: [], attempts: 0 }])),
    status: 'running',
    outputDir: settings.outputFolder + '/' + jobId,
  }
  jobs.set(jobId, job)

  runBatchInBackground(job, settings)

  return c.json({ jobId, specCount: specs.length })
})

app.get('/jobs/:id', (c) => {
  const job = jobs.get(c.req.param('id'))
  if (!job) return c.json({ error: 'not found' }, 404)
  return c.json({
    id: job.id,
    status: job.status,
    specCount: job.specs.length,
    results: Object.fromEntries(
      [...job.results.entries()].map(([k, v]) => [k, serializeResult(v)])
    ),
  })
})

export default app
