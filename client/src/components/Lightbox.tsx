import { useEffect, useState } from 'react'

interface LightboxProps {
  images: string[]
  label: string
  onClose: () => void
}

export default function Lightbox({ images, label, onClose }: LightboxProps) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [images, label])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && images.length > 1) {
        setIndex((prev) => (prev - 1 + images.length) % images.length)
      }
      if (e.key === 'ArrowRight' && images.length > 1) {
        setIndex((prev) => (prev + 1) % images.length)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [images.length, onClose])

  if (images.length === 0) return null

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
      >
        X
      </button>

      {images.length > 1 && (
        <button
          type="button"
          onClick={() => setIndex((prev) => (prev - 1 + images.length) % images.length)}
          className="absolute left-4 rounded-full border border-zinc-700 bg-zinc-900 p-3 text-zinc-100"
        >
          ←
        </button>
      )}

      <div className="max-w-6xl space-y-3">
        <p className="text-center text-sm text-zinc-300">{label}</p>
        <img src={images[index]} alt={label} className="max-h-[80vh] w-full object-contain" />
        <div className="flex justify-center">
          <a
            href={images[index]}
            download
            className="rounded-lg bg-yellow-500/20 px-4 py-2 text-sm font-medium text-yellow-300 hover:bg-yellow-500/30"
          >
            Download
          </a>
        </div>
      </div>

      {images.length > 1 && (
        <button
          type="button"
          onClick={() => setIndex((prev) => (prev + 1) % images.length)}
          className="absolute right-4 rounded-full border border-zinc-700 bg-zinc-900 p-3 text-zinc-100"
        >
          →
        </button>
      )}
    </div>
  )
}
