import ImageCard from './ImageCard'
import { getImageUrl } from '../lib/api'
import type { JobResult } from '../hooks/useJob'

interface ProgressGridProps {
  results: Record<string, JobResult>
  jobId: string
  stats: { done: number; failed: number; pending: number; running: number; total: number }
  onImageClick: (images: string[], label: string) => void
}

export default function ProgressGrid({ results, jobId, stats, onImageClick }: ProgressGridProps) {
  const progress = stats.total > 0 ? (stats.done / stats.total) * 100 : 0

  return (
    <section className="space-y-4">
      <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-sm text-zinc-300">
          {stats.done} / {stats.total} done · {stats.failed} failed · {stats.pending} pending
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full bg-yellow-400 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Object.values(results).map((result) => (
          <ImageCard
            key={result.spec.id}
            result={result}
            jobId={jobId}
            onClick={() => onImageClick(result.images.map((name) => getImageUrl(jobId, name)), result.spec.label)}
          />
        ))}
      </div>
    </section>
  )
}
