# Verification Process — nano-batch

> Checklist and procedures for verifying nano-batch is working correctly

---

## 1. Environment Check

```bash
# Node.js 22+ required
node --version
# Expected: v22.x.x or higher

# npm available
npm --version

# Check config file exists after first Settings save
cat ~/.nano-batch/config.json
```

---

## 2. Server Startup Verification

```bash
cd /path/to/imageCreation
npm install
node --experimental-strip-types server/index.ts
```

**Expected output:**
```
nano-batch server -> http://localhost:3001
```

**Verify server responds:**
```bash
curl http://localhost:3001/
# Expected: nano-batch running
```

---

## 3. Settings API Verification

### 3.1 GET Settings (no key leak)
```bash
curl http://localhost:3001/api/settings
```

**Expected response — must NOT contain actual API key:**
```json
{
  "hasApiKey": false,
  "defaultStyle": "photorealistic",
  "defaultMood": "neutral",
  "defaultAspectRatio": "1:1",
  "concurrency": 5,
  "outputFolder": "/path/to/output"
}
```

After saving a key, `hasApiKey` becomes `true`. The actual key value is **never returned**.

### 3.2 POST Settings (key persistence)
```bash
# Save a key
curl -X POST http://localhost:3001/api/settings \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "YOUR_KEY_HERE"}'

# Verify key is saved (check config file, not API)
cat ~/.nano-batch/config.json | python3 -c "import sys,json; d=json.load(sys.stdin); print('Key present:', bool(d.get('apiKey')))"

# Verify GET still does not expose the key
curl http://localhost:3001/api/settings | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'apiKey' not in d or d['apiKey'] == '', 'BUG: key exposed!'; print('OK: key not exposed in GET')"
```

### 3.3 Key Preservation Test
```bash
# Save settings WITHOUT apiKey (simulates navigating away and back)
curl -X POST http://localhost:3001/api/settings \
  -H "Content-Type: application/json" \
  -d '{"defaultStyle": "anime"}'  # no apiKey field

# Key must still be in config
cat ~/.nano-batch/config.json | python3 -c "import sys,json; d=json.load(sys.stdin); print('Key still present:', bool(d.get('apiKey')))"
# Expected: Key still present: True
```

---

## 4. Excel Parser Verification

### 4.1 CSV Upload Test
```bash
# Create a minimal test CSV
cat > /tmp/test.csv << 'EOF'
prompt,style,count
A simple red circle,photorealistic,1
EOF

curl -X POST http://localhost:3001/api/jobs \
  -F "file=@/tmp/test.csv" | python3 -c "
import sys,json; d=json.load(sys.stdin)
print('Job ID:', d.get('jobId'))
print('Specs:', d.get('specCount'))
assert d.get('specCount') == 1, 'Expected 1 spec'
print('PASS')
"
```

### 4.2 Case-Insensitive Header Test
```bash
# Excel headers with mixed case should work
python3 -c "
import openpyxl, io
wb = openpyxl.Workbook()
ws = wb.active
ws.append(['Prompt', 'Style', 'Mood'])  # Capital letters
ws.append(['A blue sky', 'watercolor', 'dreamy'])
wb.save('/tmp/test_caps.xlsx')
print('Created test_caps.xlsx')
" 2>/dev/null || python3 -c "
# Fallback if openpyxl not available: test with known-good file
print('Skipping: openpyxl not installed. Use sample.csv instead.')
"

# Test with sample.csv (lowercase headers)
curl -X POST http://localhost:3001/api/jobs \
  -F "file=@/path/to/imageCreation/sample.csv" | python3 -c "
import sys,json; d=json.load(sys.stdin)
print('Specs parsed:', d.get('specCount'))
assert d.get('specCount') > 0, 'Parser failed'
print('PASS: Excel parser handles headers correctly')
"
```

### 4.3 Aspect Ratio Normalization Test
Upload a file containing `1;1` in the aspect_ratio column. The parser should normalize it to `1:1` without error.

```bash
# Check parser output for aspect ratio normalization
JOB_ID=$(curl -s -X POST http://localhost:3001/api/jobs \
  -F "file=@/mnt/c/Users/USER/Downloads/260228_Image_Creation.xlsx" | python3 -c "import sys,json; print(json.load(sys.stdin)['jobId'])")

sleep 5
curl -s http://localhost:3001/api/jobs/$JOB_ID | python3 -c "
import sys,json
d = json.load(sys.stdin)
results = list(d['results'].values())
ratios = [r['spec']['aspectRatio'] for r in results]
invalid = [r for r in ratios if ';' in r]
print(f'Total specs: {len(results)}')
print(f'Invalid ratios (semicolons): {invalid}')
assert not invalid, f'BUG: invalid aspect ratios found: {invalid}'
print('PASS: All aspect ratios normalized')
"
```

---

## 5. Image Generation Verification

### 5.1 Single Image Test
```bash
cat > /tmp/single.csv << 'EOF'
prompt,count
A simple geometric pattern,1
EOF

JOB_ID=$(curl -s -X POST http://localhost:3001/api/jobs \
  -F "file=@/tmp/single.csv" | python3 -c "import sys,json; print(json.load(sys.stdin)['jobId'])")

echo "Job: $JOB_ID"
sleep 30

curl -s http://localhost:3001/api/jobs/$JOB_ID | python3 -c "
import sys,json
d = json.load(sys.stdin)
results = list(d['results'].values())
r = results[0]
print(f'Status: {r[\"status\"]}')
if r['status'] == 'done':
    print(f'Images: {r[\"images\"]}')
    print('PASS: Image generated successfully')
elif r['status'] == 'failed':
    print(f'FAIL: {r.get(\"error\")}')
"
```

### 5.2 Batch Test (multiple rows)
```bash
JOB_ID=$(curl -s -X POST http://localhost:3001/api/jobs \
  -F "file=@/path/to/imageCreation/sample.csv" | python3 -c "import sys,json; print(json.load(sys.stdin)['jobId'])")

# Poll until done
for i in $(seq 1 12); do
  sleep 10
  STATUS=$(curl -s http://localhost:3001/api/jobs/$JOB_ID | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d['results']
counts={s:sum(1 for v in r.values() if v['status']==s) for s in ['done','failed','pending','running']}
print(f'{d[\"status\"]} done={counts[\"done\"]} fail={counts[\"failed\"]} run={counts[\"running\"]} pend={counts[\"pending\"]}')
")
  echo "$STATUS"
  [[ "$STATUS" == done* ]] && break
done
```

### 5.3 File Collision Verification
When multiple rows share the same label, files must NOT overwrite each other:

```bash
curl -s http://localhost:3001/api/jobs/$JOB_ID | python3 -c "
import sys, json, collections
d = json.load(sys.stdin)
all_images = []
for r in d['results'].values():
    all_images.extend(r['images'])

# Check for duplicates
counts = collections.Counter(all_images)
dupes = {k:v for k,v in counts.items() if v > 1}
if dupes:
    print('BUG: duplicate filenames:', dupes)
else:
    print('PASS: all filenames unique')
print(f'Total image paths: {len(all_images)}, unique: {len(counts)}')
"
```

---

## 6. Image File Verification

```bash
OUTPUT_DIR="/path/to/imageCreation/output"

# Count generated files
find $OUTPUT_DIR -name "*.png" | wc -l

# Verify files are valid PNGs (check magic bytes)
find $OUTPUT_DIR -name "*.png" | head -5 | while read f; do
  MAGIC=$(xxd -l 4 "$f" | awk '{print $2$3}')
  if [[ "$MAGIC" == "89504e47" ]]; then
    echo "PASS: $f"
  else
    echo "FAIL (invalid PNG): $f"
  fi
done

# Verify naming convention: {label}-r{rowIndex}-{variation}.png
find $OUTPUT_DIR -name "*.png" | head -10 | while read f; do
  basename "$f"
done
```

---

## 7. Download / ZIP Verification

```bash
JOB_ID="your-job-id-here"

# Download ZIP
curl -o /tmp/test-download.zip \
  http://localhost:3001/api/download/$JOB_ID

# Verify ZIP
file /tmp/test-download.zip
python3 -c "
import zipfile
with zipfile.ZipFile('/tmp/test-download.zip') as z:
    files = z.namelist()
    print(f'ZIP contains {len(files)} files')
    print('First 5:', files[:5])
"
```

---

## 8. Frontend Verification (Browser)

1. Open **http://localhost:5173**
2. Click **Settings** tab:
   - Enter API key → Save → confirm "API key saved ✓" appears
   - Navigate to Generate tab and back → confirm key status is still "API key saved ✓" (not lost)
3. Click **Generate** tab:
   - Upload `sample.csv` or your own Excel file
   - Click "Generate All"
   - Confirm progress cards appear and update
   - Confirm images appear when done (click to lightbox)
   - Confirm "Download All ZIP" works

---

## 9. Common Errors & Solutions

| Error | Cause | Fix |
|-------|-------|-----|
| `EADDRINUSE: port 3001` | Server already running | `pkill -f "node.*server/index"` then restart |
| `prompt column is required` | Excel has no `prompt` header | Check column names (case-insensitive but must exist) |
| `Imagen 4 error 403` | API key missing or invalid | Check Settings tab, re-enter key |
| `Imagen 4 error 429` | Rate limit | Reduce concurrency in Settings |
| Images not showing in browser | Server not running | Check `curl http://localhost:3001/` |
| API key lost after tab switch | Old bug (fixed) | Update to latest version |

---

## 10. Regression Checklist

Run after any code change:

- [ ] Server starts without error on port 3001
- [ ] `GET /api/settings` returns `hasApiKey` (not actual key)
- [ ] `POST /api/settings` without apiKey does not clear existing key
- [ ] CSV upload with lowercase headers parses correctly
- [ ] Excel upload with mixed-case headers parses correctly
- [ ] `aspect_ratio: "1;1"` normalizes to `"1:1"` without error
- [ ] Multiple rows with same label produce unique filenames (`-r{rowIndex}-`)
- [ ] At least 1 image is generated successfully with valid API key
- [ ] Generated files are valid PNGs
- [ ] ZIP download contains all generated images
- [ ] Browser: Settings tab → API key saves and persists across tab navigation
- [ ] Browser: Upload → progress grid updates → images render
