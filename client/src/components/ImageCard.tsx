import { getImageUrl } from '../lib/api'
import type { JobResult } from '../hooks/useJob'

interface ImageCardProps {
  result: JobResult
  jobId: string
  onClick: () => void
}

function truncateError(message?: string) {
  if (!message) return 'Unknown error'
  return message.length > 50 ? `${message.slice(0, 50)}...` : message
}

export default function ImageCard({ result, jobId, onClick }: ImageCardProps) {
  if (result.status === 'pending') {
    return (
      <div className="bg-zinc-800 rounded-xl p-4">
        <p className="text-xs uppercase tracking-wide text-zinc-400">pending</p>
        <p className="mt-1 text-sm font-medium text-zinc-100">{result.spec.label}</p>
      </div>
    )
  }

  if (result.status === 'running') {
    return (
      <div className="animate-pulse rounded-xl border border-zinc-700 bg-zinc-900 p-4">
        <p className="text-xs uppercase tracking-wide text-zinc-400">running</p>
        <p className="mt-1 text-sm text-zinc-200">Generating...</p>
        <p className="mt-2 text-sm font-medium text-zinc-100">{result.spec.label}</p>
      </div>
    )
  }

  if (result.status === 'failed') {
    return (
      <div className="rounded-xl border border-red-800 bg-red-900/20 p-4">
        <p className="text-sm font-semibold text-red-300">Failed</p>
        <p className="mt-1 text-sm text-red-200">{result.spec.label}</p>
        <p className="mt-2 text-xs text-red-300">{truncateError(result.error)}</p>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 text-left transition-colors hover:border-zinc-600"
    >
      <img
        src={getImageUrl(jobId, result.images[0])}
        alt={result.spec.label}
        className="h-36 w-full object-cover"
      />
      <div className="flex items-center justify-between p-3">
        <p className="text-sm font-medium text-zinc-100">{result.spec.label}</p>
        <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-300">{result.images.length}</span>
      </div>
    </button>
  )
}
