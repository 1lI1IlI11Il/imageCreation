# Coding Process — nano-batch

> How nano-batch was designed and built using AI-assisted development with Claude Code + Pumasi (parallel Codex agents)

---

## 1. Motivation

The goal was to create a **local batch AI image generator** that:
- Accepts Excel/CSV files as input (each row = one image prompt)
- Calls Google's nano banana (Gemini Imagen) API in parallel
- Saves results locally without any cloud dependency beyond the API

---

## 2. Research Phase

Before writing any code, the following was investigated:

### What is nano banana?
- **nano banana** = Google's AI image generation model powered by Gemini
- Available as `nano-banana-pro-preview` via the Gemini API
- Also accessible through **Google Antigravity** (Google's agentic IDE)
- Primary alternative: **Imagen 4** (`imagen-4.0-generate-001`) — higher quality

### API Discovery
Model availability was confirmed by calling the Gemini API's ListModels endpoint. Key image-generation models found:

| Model | Type | Method |
|-------|------|--------|
| `imagen-4.0-generate-001` | Imagen 4 | `predict` |
| `nano-banana-pro-preview` | nano banana | `generateContent` |
| `gemini-2.0-flash-exp-image-generation` | Gemini Flash | `generateContent` |
| `gemini-2.5-flash-image` | Gemini 2.5 | `generateContent` |

### Excel Parsing Strategy
- Library: `xlsx` (SheetJS) — handles `.xlsx`, `.xls`, `.csv`
- Key challenge: Excel headers preserve original casing (`Prompt`, `Style`) but code uses lowercase keys
- Solution: `normalizeKey()` function that lowercases and replaces spaces/hyphens with underscores

---

## 3. PRD (Product Requirements Document)

A full PRD was written before implementation: [`PRD.md`](../PRD.md)

Key decisions made in PRD:
- **Local-first**: API key stored in `~/.nano-batch/config.json`, never in code
- **Parallel execution**: Promise pool pattern with configurable concurrency (default 5)
- **Retry logic**: 3 attempts with exponential backoff (1s, 2s, 4s)
- **Filename convention**: `{label}-r{rowIndex}-{variation}.png` to avoid collisions

---

## 4. Implementation via Pumasi (Parallel Codex Agents)

The implementation used **Pumasi** — a parallel agent orchestration pattern where Claude acts as PM/architect and multiple Codex CLI instances implement tasks simultaneously.

### Round 1 — Scaffold (6 parallel tasks)

All tasks ran simultaneously using `pumasi.sh`:

| Task | Codex Agent | Output |
|------|------------|--------|
| `setup-scaffold` | Codex #1 | `package.json`, `tsconfig.json`, `vite.config.ts`, base types |
| `excel-parser` | Codex #2 | `server/services/excel-parser.ts` |
| `gemini-service` | Codex #3 | `server/services/gemini.ts` |
| `image-saver` | Codex #4 | `server/services/image-saver.ts` |
| `backend-server` | Codex #5 | `server/routes/` (settings, jobs, images) |
| `frontend-app` | Codex #6 | `client/src/` (all components + hooks) |

**Result**: 6 Codex agents worked in parallel. Some scaffold files needed to be manually written after the agents wrote to incorrect paths.

### Round 2 — Bug Fixes (3 parallel tasks)

After initial testing, 3 bugs were found and fixed in parallel:

| Task | Bug | Fix |
|------|-----|-----|
| `fix-apikey-server` | GET returns masked key → overwritten on save | Return `hasApiKey: boolean` only |
| `fix-apikey-frontend` | UI loads masked key into form | `keyStatus: 'saved'\|'editing'` state pattern |
| `fix-excel-parser` | Case-sensitive header lookup fails | `normalizeKey()` + `normalizeRow()` |

---

## 5. Bugs Found & Fixed

### Bug 1: API Key Overwrite
**Root cause**: `GET /api/settings` returned `****wxyz` (masked key). `SettingsPanel` loaded this into the form state. On save, it POSTed the masked value back, overwriting the real key.

**Fix**:
- Server GET → returns `{ hasApiKey: boolean, ...otherSettings }` (no key value)
- Server POST → if `body.apiKey` is empty/missing, keep existing key
- Frontend → tracks `keyStatus: 'saved' | 'editing'`, only sends `apiKey` when user types a new one

### Bug 2: Excel Header Case Mismatch
**Root cause**: `xlsx.sheet_to_json()` preserves original header casing. Code used lowercase keys for lookup (`row['prompt']`), but actual keys were `'Prompt'`, `'Style'`, etc.

**Fix**: Added `normalizeKey()` and `normalizeRow()` to convert all headers to lowercase with underscores before processing.

### Bug 3: Aspect Ratio Semicolons
**Root cause**: User's Excel file had `1;1` (semicolon) instead of `1:1` (colon) in the aspect_ratio column.

**Fix**: `rawRatio.replace(/;/g, ':')` + validation against known valid ratios with fallback to default.

### Bug 4: Filename Collision
**Root cause**: Multiple rows with the same `label` (e.g., all tarot cards labeled `taro`) wrote to the same filenames, overwriting each other.

**Fix**: Changed filename format from `{label}-{n}.png` to `{label}-r{rowIndex}-{n}.png`.

### Bug 5: Wrong Model Names
**Root cause**: PRD specified `imagen-3.0-generate-002` and `gemini-2.0-flash-preview-image-generation`, but these models don't exist for this API key.

**Fix**: Discovered actual available models via ListModels API call:
- Primary: `imagen-4.0-generate-001`
- Fallback: `nano-banana-pro-preview`

### Bug 6: WebSocket Incompatibility
**Root cause**: Server used Bun WebSocket API (`serve({ websocket: {...} })`), which is not supported by `@hono/node-server` on Node.js.

**Fix**: Replaced WebSocket with 2-second HTTP polling (`setInterval(() => getJob(id), 2000)`).

---

## 6. Key Design Decisions

### Why Promise Pool for Concurrency?
Instead of `Promise.all()` (which fires everything at once) or sequential processing, a promise pool limits active concurrent requests:

```ts
const executing: Promise<void>[] = []
for (const spec of tasks) {
  const p = processJob(spec).then(() => executing.splice(executing.indexOf(p), 1))
  executing.push(p)
  if (executing.length >= concurrency) await Promise.race(executing)
}
await Promise.all(executing)
```

This keeps exactly `concurrency` jobs running at any time, preventing API rate limit errors.

### Why No SDK?
The Gemini TypeScript SDK was not used — only `fetch()`. This keeps the bundle lean and avoids SDK version compatibility issues. The API is simple enough (POST JSON, receive base64 images) that a thin fetch wrapper suffices.

### Why Polling Over WebSocket?
WebSocket requires additional Node.js setup (the `ws` package and upgrade handling). Since image generation takes 5–30 seconds per image, 2-second polling provides adequate real-time feel without the complexity.

---

## 7. File Naming Convention

Generated images follow the pattern:
```
output/{job-id}/{label}-r{rowIndex}-{variation}.png
```

Example: `output/abc123/taro-r4-2.png`
- `taro` = label from Excel
- `r4` = row index 4 (prevents collision when multiple rows share label)
- `2` = second variation (count > 1)

---

## 8. Technology Choices

| Decision | Choice | Reason |
|----------|--------|--------|
| Backend framework | Hono | Lightweight, TypeScript-native, fast |
| Runtime | Node.js 22 | Available everywhere, `--experimental-strip-types` avoids build step |
| Frontend | React 19 + Vite 6 | Modern, fast HMR, compatible with Tailwind 4 |
| CSS | Tailwind 4 | Zero-config, works as Vite plugin |
| Excel parsing | xlsx (SheetJS) | Handles xlsx/xls/csv, battle-tested |
| ZIP | JSZip | Pure JS, no native deps |
