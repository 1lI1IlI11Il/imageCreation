# nano-batch 🍌

> **Excel → AI Images · Batch generator powered by nano banana (Gemini Imagen 4)**

Upload a spreadsheet, hit Generate, and watch dozens of AI images render in parallel — saved locally, downloadable as ZIP.

---

## What It Does

| Input | Output |
|-------|--------|
| `.xlsx` / `.csv` with a `prompt` column | PNG images in `output/` |
| Each row = one image job | Up to 4 variations per row |
| Optional: style, mood, aspect ratio | Parallel generation (configurable) |

---

## Quick Start

### Prerequisites
- Node.js 22+
- A free [Google AI Studio API key](https://aistudio.google.com/apikey)

### Install & Run

```bash
git clone https://github.com/1lI1IlI11Il/imageCreation.git
cd imageCreation
npm install
npm run dev
```

Open **http://localhost:5173**

1. Go to **Settings** → paste your Google AI Studio API key → Save
2. Go to **Generate** → upload your Excel/CSV file → click **Generate All**
3. Watch images appear in real-time → Download individual or all as ZIP

---

## Excel / CSV Format

| Column | Required | Example |
|--------|----------|---------|
| `prompt` | ✅ | `A red panda eating ramen in Tokyo` |
| `style` | optional | `anime` \| `photorealistic` \| `oil-painting` \| `watercolor` \| `pixel-art` \| `sketch` \| `3d-render` \| `comic` |
| `mood` | optional | `vibrant` \| `cinematic` \| `dreamy` \| `dark` \| `minimal` \| `neutral` |
| `aspect_ratio` | optional | `1:1` \| `16:9` \| `9:16` \| `4:3` \| `3:4` |
| `count` | optional | `1`–`4` (variations per prompt) |
| `label` | optional | `my-image` (used in filename) |
| `negative_prompt` | optional | `blurry, low quality` |

### Sample rows

```csv
prompt,style,mood,aspect_ratio,count,label
A futuristic city at sunset,3d-render,cinematic,16:9,2,city
Cute robot chef in a kitchen,anime,vibrant,1:1,3,robot
Watercolor map of a fantasy world,watercolor,dreamy,4:3,1,map
```

---

## Architecture

```
nano-batch/
├── server/                   # Bun/Node + Hono backend (port 3001)
│   ├── index.ts              # Server entry
│   ├── routes/
│   │   ├── settings.ts       # GET/POST /api/settings
│   │   ├── jobs.ts           # POST /api/jobs, GET /api/jobs/:id
│   │   └── images.ts         # GET /api/images/:id/:file, /api/download/:id
│   └── services/
│       ├── excel-parser.ts   # xlsx/csv → JobSpec[] (case-insensitive headers)
│       ├── gemini.ts         # Imagen 4 API + nano-banana fallback
│       └── image-saver.ts    # Write PNG to disk, ZIP export
│
├── client/                   # React 19 + Vite 6 + Tailwind 4 SPA (port 5173)
│   └── src/
│       ├── App.tsx           # Tab layout: Generate | Settings
│       ├── components/       # UploadPanel, SettingsPanel, ProgressGrid, ImageCard, Lightbox
│       └── hooks/useJob.ts   # Polling-based job state management
│
└── output/                   # Generated images (gitignored)
    └── [job-id]/
        └── [label]-r[row]-[n].png
```

---

## Image Models Used

| Priority | Model | Notes |
|----------|-------|-------|
| Primary | `imagen-4.0-generate-001` | Google Imagen 4, highest quality |
| Fallback | `nano-banana-pro-preview` | Google nano banana, chat-based generation |

Both are accessed via the [Google AI Gemini API](https://ai.google.dev/).

---

## Settings

Settings are stored in `~/.nano-batch/config.json` (never committed).

| Setting | Default | Description |
|---------|---------|-------------|
| API Key | — | Google AI Studio key |
| Default Style | `photorealistic` | Applied when row has no `style` |
| Default Mood | `neutral` | Applied when row has no `mood` |
| Aspect Ratio | `1:1` | Applied when row has no `aspect_ratio` |
| Concurrency | `5` | Simultaneous image generation jobs |
| Output Folder | `./output` | Where PNGs are saved |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 (ESM + `--experimental-strip-types`) |
| Backend | [Hono](https://hono.dev/) + `@hono/node-server` |
| Frontend | React 19 + Vite 6 + Tailwind CSS 4 |
| Excel parsing | [xlsx](https://sheetjs.com/) |
| ZIP export | [JSZip](https://stuk.github.io/jszip/) |
| Image API | Google Gemini (Imagen 4 / nano banana) |

---

## License

MIT
