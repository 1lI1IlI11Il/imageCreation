import { useState } from 'react'
import { useJob } from './hooks/useJob'
import { getDownloadUrl } from './lib/api'
import SettingsPanel from './components/SettingsPanel'
import UploadPanel from './components/UploadPanel'
import ProgressGrid from './components/ProgressGrid'
import Lightbox from './components/Lightbox'
import type { JobResult } from './hooks/useJob'

export default function App() {
  const [tab, setTab] = useState<'generate' | 'settings'>('generate')
  const [lightbox, setLightbox] = useState<{ images: string[]; label: string } | null>(null)
  const { jobId, jobStatus, results, startJob, stats } = useJob()

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">nano-batch</h1>
          <p className="text-zinc-500 text-sm">Excel to AI Images via nano banana (Gemini)</p>
        </div>
        <nav className="flex gap-2">
          {(['generate', 'settings'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-yellow-500/20 text-yellow-300'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t === 'generate' ? 'Generate' : 'Settings'}
            </button>
          ))}
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {tab === 'settings' && <SettingsPanel />}
        {tab === 'generate' && (
          <div className="space-y-8">
            <UploadPanel
              onGenerate={startJob}
              isLoading={jobStatus === 'uploading' || jobStatus === 'running'}
            />
            {jobId && (
              <>
                <div className="flex justify-end">
                  <a
                    href={getDownloadUrl(jobId)}
                    className="px-4 py-2 bg-yellow-500/20 text-yellow-300 rounded-lg text-sm font-medium hover:bg-yellow-500/30 transition-colors"
                  >
                    Download All ZIP
                  </a>
                </div>
                <ProgressGrid
                  results={results}
                  jobId={jobId}
                  stats={stats}
                  onImageClick={(images, label) => setLightbox({ images, label })}
                />
              </>
            )}
          </div>
        )}
      </main>
      {lightbox && (
        <Lightbox images={lightbox.images} label={lightbox.label} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}
