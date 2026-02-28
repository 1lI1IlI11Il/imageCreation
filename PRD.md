# PRD: nano-batch — Excel-to-Image Batch Generator

**Version:** 1.0
**Date:** 2026-02-28
**Tech:** Bun · Hono · React 19 · Vite 6 · Tailwind 4
**Image API:** Google Gemini (nano banana / imagen-3.0-generate-002)

---

## 1. Product Overview

**nano-batch** is a locally-run web application that reads an Excel or CSV table of prompts and generation settings, then calls the Google Gemini image generation API (nano banana) to produce **dozens of images in parallel**, saving them to a local output folder.

### Problem
Generating many AI images one by one is tedious. Users want to define a batch in a spreadsheet and kick off 20–100 image generations at once.

### Solution
A local app where users:
1. Upload an `.xlsx` / `.csv` file — each row = one image job
2. Configure their Gemini API key once
3. Hit "Generate All" and watch a live progress grid fill up
4. Download individual images or a full ZIP

---

## 2. User Stories

| # | As a... | I want to... | So that... |
|---|---------|-------------|-----------|
| 1 | Creator | Upload an Excel file with prompts | I can define 50 images at once |
| 2 | Creator | See a live progress grid | I know which images are done/pending/failed |
| 3 | Creator | Preview each image in the browser | I can check quality before saving |
| 4 | Creator | Download images individually or as ZIP | I can use them in my project |
| 5 | Creator | Set global defaults (style, size, model) | I don't repeat settings in every row |
| 6 | Creator | Retry failed images | I don't lose work from API errors |
| 7 | Creator | Save my API key locally | I don't re-enter it every session |
| 8 | Creator | See different image types per row | Each row can have different style/mood |

---

## 3. Excel / CSV Schema

### Required Columns
| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `prompt` | string | Image generation prompt | `"A futuristic city at sunset, cyberpunk"` |

### Optional Columns (override globals)
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `style` | string | `photorealistic` | Art style: `photorealistic`, `anime`, `oil-painting`, `watercolor`, `pixel-art`, `sketch`, `3d-render`, `comic` |
| `mood` | string | `neutral` | Mood modifier: `cinematic`, `dreamy`, `dark`, `vibrant`, `minimal` |
| `aspect_ratio` | string | `1:1` | `1:1`, `16:9`, `9:16`, `4:3`, `3:4` |
| `count` | int | `1` | How many variations to generate per row (1–4) |
| `negative_prompt` | string | `` | Things to exclude |
| `seed` | int | random | For reproducibility |
| `label` | string | row number | Custom label for the output filename |

### Example Excel Table

| prompt | style | mood | aspect_ratio | count | label |
|--------|-------|------|--------------|-------|-------|
| A red panda eating ramen in Tokyo | anime | vibrant | 1:1 | 2 | panda-ramen |
| Ancient Greek temple at golden hour | oil-painting | cinematic | 16:9 | 1 | greek-temple |
| Minimalist logo for a coffee brand | sketch | minimal | 1:1 | 3 | coffee-logo |
| Astronaut surfing on Saturn's rings | photorealistic | dreamy | 16:9 | 2 | astro-surf |

---

## 4. Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  BROWSER (React 19 SPA)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │  Upload  │  │ Settings │  │ Progress │  │Gallery │  │
│  │  Panel   │  │  Panel   │  │  Grid    │  │ + ZIP  │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP / WebSocket
┌───────────────────────▼─────────────────────────────────┐
│              LOCAL SERVER (Bun + Hono)                   │
│  POST /api/jobs        → create batch job                │
│  GET  /api/jobs/:id    → job status + results            │
│  GET  /api/images/:fn  → serve generated image           │
│  GET  /api/download    → zip all images                  │
│  POST /api/settings    → save API key + defaults         │
│  WS   /api/ws          → live progress updates           │
└────────────┬────────────────────────────────────────────┘
             │
    ┌────────▼─────────────────────────────────┐
    │        BATCH ENGINE (concurrent)          │
    │  · Parse Excel → array of jobs            │
    │  · Run N jobs in parallel (concurrency=5) │
    │  · Retry failed jobs (max 3 attempts)     │
    │  · Stream progress via WebSocket          │
    └────────┬─────────────────────────────────┘
             │ Google Gemini API
    ┌────────▼─────────────────────────────────┐
    │   nano banana (Gemini Image Generation)  │
    │   Model: imagen-3.0-generate-002          │
    │   Alt:   gemini-2.0-flash-preview-image  │
    └──────────────────────────────────────────┘
             │ Save PNG/JPEG
    ┌────────▼─────────────────────────────────┐
    │   output/[job-id]/[label]-[n].png        │
    └──────────────────────────────────────────┘
```

---

## 5. Feature Requirements

### 5.1 File Upload
- Accept `.xlsx`, `.xls`, `.csv`
- Parse on backend, return preview table to frontend
- Validate required `prompt` column; show warnings for unknown columns
- Support up to 500 rows

### 5.2 Global Settings Panel
- **Gemini API key** — stored in `~/.nano-batch/config.json` (never in project files)
- **Default style** — dropdown with 8 options
- **Default mood** — dropdown
- **Default aspect ratio** — dropdown
- **Concurrency** — slider 1–10 (default 5)
- **Output folder** — path selector (default `./output`)

### 5.3 Batch Generation
- Build full prompt string: `[prompt], [style] style, [mood] mood`
- Call Gemini API with proper parameters
- Run up to `concurrency` jobs simultaneously
- Emit WebSocket event per job: `pending → running → done | failed`
- Retry failed jobs up to 3× with exponential backoff
- Save images to `output/[job-id]/[label]-[variation].png`

### 5.4 Progress Grid
- Card per row from Excel
- Status indicator: ⏳ pending / 🔄 running / ✅ done / ❌ failed
- Show thumbnail when done (click to open full size)
- Summary bar: "42 / 60 done · 3 failed · 15 pending"

### 5.5 Gallery & Download
- Masonry grid of completed images
- Click image → lightbox with full resolution
- "Download" button per image
- "Download All (ZIP)" button — uses JSZip on frontend

### 5.6 Retry & Resume
- Retry individual failed images
- "Retry All Failed" button
- Jobs persist in memory for the session

---

## 6. API Integration — Gemini (nano banana)

### Image Generation (Imagen 3)
```
POST https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict
Authorization: Bearer {API_KEY}
Content-Type: application/json

{
  "instances": [{ "prompt": "A red panda eating ramen, anime style, vibrant mood" }],
  "parameters": {
    "sampleCount": 2,
    "aspectRatio": "1:1",
    "negativePrompt": ""
  }
}
```

### Response
```json
{
  "predictions": [
    { "bytesBase64Encoded": "...", "mimeType": "image/png" },
    { "bytesBase64Encoded": "...", "mimeType": "image/png" }
  ]
}
```

### Fallback Model (Gemini 2.0 Flash Image)
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent
```

---

## 7. File Structure

```
nano-batch/
├── PRD.md                    # This document
├── package.json              # Bun workspace root
├── .gitignore
│
├── server/                   # Bun + Hono backend
│   ├── index.ts              # Entry point (port 3001)
│   ├── routes/
│   │   ├── jobs.ts           # POST /api/jobs, GET /api/jobs/:id
│   │   ├── images.ts         # GET /api/images/:fn, GET /api/download
│   │   └── settings.ts       # POST/GET /api/settings
│   ├── services/
│   │   ├── excel-parser.ts   # xlsx → JobSpec[]
│   │   ├── gemini.ts         # Gemini API client
│   │   ├── batch-engine.ts   # Parallel job runner + WebSocket
│   │   └── image-saver.ts    # Write PNG to disk
│   └── types.ts              # Shared types
│
├── client/                   # React 19 + Vite 6 SPA
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── UploadPanel.tsx
│   │   │   ├── SettingsPanel.tsx
│   │   │   ├── ProgressGrid.tsx
│   │   │   ├── ImageCard.tsx
│   │   │   ├── Gallery.tsx
│   │   │   └── Lightbox.tsx
│   │   ├── hooks/
│   │   │   ├── useJob.ts       # Job state + WebSocket
│   │   │   └── useSettings.ts  # Settings persistence
│   │   └── lib/
│   │       └── api.ts          # fetch wrappers
│
└── output/                   # Generated images (gitignored)
    └── [job-id]/
        └── [label]-[n].png
```

---

## 8. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Concurrent image jobs | Up to 10 simultaneously |
| Max batch size | 500 rows per Excel |
| Image generation latency | ~5–15 sec per image (API-dependent) |
| Startup time | < 3 sec |
| Supported OS | Windows (WSL2), macOS, Linux |
| No cloud dependency | Runs fully local (API key stored locally) |
| Browser support | Chrome 120+, Edge 120+, Firefox 120+ |

---

## 9. Out of Scope (v1)

- User accounts / multi-user
- Image editing after generation
- Stable Diffusion / local model support (API only for v1)
- Mobile app
- Scheduled / cron batch jobs

---

## 10. Setup Instructions (for users)

```bash
# 1. Clone / download the project
cd nano-batch

# 2. Install dependencies
bun install

# 3. Start the app
bun run dev

# 4. Open browser
open http://localhost:5173

# 5. Enter your Google AI Studio API key in Settings
#    Get one free at: https://aistudio.google.com/apikey

# 6. Upload your Excel file and click "Generate All"
```

---

## 11. Implementation Phases (Pumasi Tasks)

### Round 1 — Scaffold (sequential first)
- `setup-scaffold`: project init, package.json, tsconfig, vite config

### Round 2 — Core Services (parallel)
- `excel-parser`: xlsx/csv parsing service
- `gemini-service`: Gemini image API client with retry logic
- `image-saver`: file writing + output dir management

### Round 3 — Server + Client (parallel)
- `backend-server`: Hono API + WebSocket batch engine
- `frontend-app`: React UI — upload, settings, progress grid, gallery
