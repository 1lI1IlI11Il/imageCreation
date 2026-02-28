export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
export type StyleOption = 'photorealistic' | 'anime' | 'oil-painting' | 'watercolor' | 'pixel-art' | 'sketch' | '3d-render' | 'comic'
export type MoodOption = 'neutral' | 'cinematic' | 'dreamy' | 'dark' | 'vibrant' | 'minimal'
export type JobStatus = 'pending' | 'running' | 'done' | 'failed'

export interface JobSpec {
  id: string
  rowIndex: number
  prompt: string
  style: StyleOption
  mood: MoodOption
  aspectRatio: AspectRatio
  count: number
  negativePrompt: string
  seed?: number
  label: string
}

export interface JobResult {
  spec: JobSpec
  status: JobStatus
  images: string[]
  error?: string
  attempts: number
  startedAt?: number
  completedAt?: number
}

export interface BatchJob {
  id: string
  createdAt: number
  specs: JobSpec[]
  results: Map<string, JobResult>
  status: 'running' | 'done' | 'partial'
  outputDir: string
}

export interface Settings {
  apiKey: string
  defaultStyle: StyleOption
  defaultMood: MoodOption
  defaultAspectRatio: AspectRatio
  concurrency: number
  outputFolder: string
}
