import { useState, useEffect, useRef, useCallback } from 'react'
import { uploadFile, getJob } from '../lib/api'

export type JobStatus = 'idle' | 'uploading' | 'running' | 'done'

export interface JobResult {
  spec: { id: string; label: string; prompt: string; count: number }
  status: 'pending' | 'running' | 'done' | 'failed'
  images: string[]
  error?: string
}

export function useJob() {
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus>('idle')
  const [results, setResults] = useState<Record<string, JobResult>>({})
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const startJob = useCallback(async (file: File) => {
    stopPolling()
    setJobStatus('uploading')
    setResults({})
    try {
      const { jobId: id } = await uploadFile(file)
      setJobId(id)
      setJobStatus('running')

      // Poll every 2 seconds for progress updates
      pollRef.current = setInterval(async () => {
        try {
          const job = await getJob(id)
          setResults(job.results || {})
          if (job.status === 'done') {
            setJobStatus('done')
            stopPolling()
          }
        } catch {
          // ignore transient errors
        }
      }, 2000)

      // Initial load
      const job = await getJob(id)
      setResults(job.results || {})
    } catch (e) {
      setJobStatus('idle')
      throw e
    }
  }, [])

  useEffect(() => () => stopPolling(), [])

  const statValues = Object.values(results)
  return {
    jobId,
    jobStatus,
    results,
    startJob,
    stats: {
      done: statValues.filter((r) => r.status === 'done').length,
      failed: statValues.filter((r) => r.status === 'failed').length,
      pending: statValues.filter((r) => r.status === 'pending').length,
      running: statValues.filter((r) => r.status === 'running').length,
      total: statValues.length,
    },
  }
}
