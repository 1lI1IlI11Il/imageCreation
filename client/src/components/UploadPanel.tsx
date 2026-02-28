import { useRef, useState, type DragEvent } from 'react'

interface UploadPanelProps {
  onGenerate: (file: File) => void
  isLoading: boolean
}

const ACCEPT = '.xlsx,.xls,.csv'

export default function UploadPanel({ onGenerate, isLoading }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const pickFile = () => inputRef.current?.click()

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    setFile(files[0])
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(false)
    handleFiles(event.dataTransfer.files)
  }

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-zinc-100 space-y-4">
      <h2 className="text-lg font-semibold">Upload</h2>

      <div
        className={`rounded-lg border-2 border-dashed p-6 text-center transition ${
          isDragOver ? 'border-zinc-300 bg-zinc-800' : 'border-zinc-700'
        }`}
        onClick={pickFile}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <p className="text-zinc-300 mb-3">Drag and drop an Excel/CSV file, or click to upload.</p>
        <button
          type="button"
          onClick={pickFile}
          className="rounded-md border border-zinc-600 px-4 py-2 hover:bg-zinc-800"
        >
          Choose File
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <p className="text-sm text-zinc-400">{file ? `Selected: ${file.name}` : 'No file selected'}</p>

      <button
        type="button"
        disabled={!file || isLoading}
        onClick={() => file && onGenerate(file)}
        className="rounded-md bg-zinc-100 text-zinc-900 px-4 py-2 font-medium disabled:opacity-60"
      >
        {isLoading ? 'Generating...' : 'Generate All'}
      </button>
    </section>
  )
}
