import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollActiveRef = useRef(false)
  const pollInFlightRef = useRef(false)

  const stopPolling = useCallback(() => {
    pollActiveRef.current = false
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
  }, [])

  const pollOnce = useCallback(async (id: string) => {
    if (!pollActiveRef.current || pollInFlightRef.current) return
    pollInFlightRef.current = true
    try {
      const job = await getJob(id)
      setResults(job.results || {})
      if (job.status === 'done') {
        setJobStatus('done')
        stopPolling()
      }
    } catch {
      // ignore transient errors
    } finally {
      pollInFlightRef.current = false
    }
  }, [stopPolling])

  const schedulePolling = useCallback((id: string) => {
    if (!pollActiveRef.current) return
    pollTimeoutRef.current = setTimeout(async () => {
      await pollOnce(id)
      schedulePolling(id)
    }, 2000)
  }, [pollOnce])

  const startJob = useCallback(async (file: File) => {
    stopPolling()
    setJobStatus('uploading')
    setResults({})
    try {
      const { jobId: id } = await uploadFile(file)
      setJobId(id)
      setJobStatus('running')
      pollActiveRef.current = true
      await pollOnce(id)
      schedulePolling(id)
    } catch (e) {
      setJobStatus('idle')
      throw e
    }
  }, [pollOnce, schedulePolling, stopPolling])

  useEffect(() => () => stopPolling(), [stopPolling])

  const stats = useMemo(() => {
    const totals = { done: 0, failed: 0, pending: 0, running: 0, total: 0 }
    for (const result of Object.values(results)) {
      totals.total++
      if (result.status === 'done') totals.done++
      else if (result.status === 'failed') totals.failed++
      else if (result.status === 'pending') totals.pending++
      else if (result.status === 'running') totals.running++
    }
    return totals
  }, [results])

  return {
    jobId,
    jobStatus,
    results,
    startJob,
    stats,
  }
}
