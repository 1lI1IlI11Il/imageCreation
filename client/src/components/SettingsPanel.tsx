import { useEffect, useState } from 'react'
import { getSettings, saveSettings } from '../lib/api'

type SettingsState = {
  defaultStyle: string
  defaultMood: string
  defaultAspectRatio: string
  concurrency: number
  outputFolder: string
}

const styleOptions = [
  'photorealistic',
  'anime',
  'oil-painting',
  'watercolor',
  'pixel-art',
  'sketch',
  '3d-render',
  'comic'
]

const moodOptions = ['neutral', 'cinematic', 'dreamy', 'dark', 'vibrant', 'minimal']
const aspectOptions = ['1:1', '16:9', '9:16', '4:3', '3:4']

const defaultSettings: SettingsState = {
  defaultStyle: styleOptions[0],
  defaultMood: moodOptions[0],
  defaultAspectRatio: aspectOptions[0],
  concurrency: 3,
  outputFolder: './output'
}

export default function SettingsPanel() {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings)
  const [keyStatus, setKeyStatus] = useState<'saved' | 'editing'>('editing')
  const [newApiKey, setNewApiKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const loaded = (await getSettings()) as {
        hasApiKey?: boolean
        defaultStyle?: string
        defaultMood?: string
        defaultAspectRatio?: string
        concurrency?: number
        outputFolder?: string
      }
      if (!mounted) return
      setKeyStatus(loaded.hasApiKey ? 'saved' : 'editing')
      setSettings({
        defaultStyle: loaded.defaultStyle ?? defaultSettings.defaultStyle,
        defaultMood: loaded.defaultMood ?? defaultSettings.defaultMood,
        defaultAspectRatio: loaded.defaultAspectRatio ?? defaultSettings.defaultAspectRatio,
        concurrency: loaded.concurrency ?? defaultSettings.concurrency,
        outputFolder: loaded.outputFolder ?? defaultSettings.outputFolder
      })
    }
    void load()
    return () => {
      mounted = false
    }
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    const payload: Record<string, unknown> = {
      defaultStyle: settings.defaultStyle,
      defaultMood: settings.defaultMood,
      defaultAspectRatio: settings.defaultAspectRatio,
      concurrency: settings.concurrency,
      outputFolder: settings.outputFolder,
      ...(keyStatus === 'editing' && newApiKey.trim() ? { apiKey: newApiKey.trim() } : {})
    }
    await saveSettings(payload)
    if (keyStatus === 'editing' && newApiKey.trim()) setKeyStatus('saved')
    setNewApiKey('')
    setIsSaving(false)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-zinc-100 space-y-4">
      <h2 className="text-lg font-semibold">Settings</h2>

      <label className="block space-y-1">
        <span className="text-sm text-zinc-300">API Key (Google AI Studio)</span>
        {keyStatus === 'saved' ? (
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 text-sm font-medium">API key saved ✓</span>
            <button
              type="button"
              onClick={() => {
                setKeyStatus('editing')
                setNewApiKey('')
              }}
              className="text-xs text-zinc-400 underline hover:text-zinc-200"
            >
              Change
            </button>
          </div>
        ) : (
          <input
            type="password"
            value={newApiKey}
            onChange={(e) => setNewApiKey(e.target.value)}
            placeholder="Paste your Google AI Studio API key"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder-zinc-600"
          />
        )}
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm text-zinc-300">Default Style</span>
          <select
            value={settings.defaultStyle}
            onChange={(e) => setSettings((prev) => ({ ...prev, defaultStyle: e.target.value }))}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
          >
            {styleOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-zinc-300">Default Mood</span>
          <select
            value={settings.defaultMood}
            onChange={(e) => setSettings((prev) => ({ ...prev, defaultMood: e.target.value }))}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
          >
            {moodOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-zinc-300">Default Aspect Ratio</span>
          <select
            value={settings.defaultAspectRatio}
            onChange={(e) => setSettings((prev) => ({ ...prev, defaultAspectRatio: e.target.value }))}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
          >
            {aspectOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-zinc-300">Concurrency: {settings.concurrency}</span>
          <input
            type="range"
            min={1}
            max={10}
            value={settings.concurrency}
            onChange={(e) => setSettings((prev) => ({ ...prev, concurrency: Number(e.target.value) }))}
            className="w-full"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm text-zinc-300">Output Folder</span>
        <input
          type="text"
          value={settings.outputFolder}
          onChange={(e) => setSettings((prev) => ({ ...prev, outputFolder: e.target.value }))}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-lg bg-yellow-500/20 px-4 py-2 text-sm font-medium text-yellow-300 transition-colors hover:bg-yellow-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && <span className="text-emerald-400 text-sm">Saved!</span>}
      </div>
    </section>
  )
}
