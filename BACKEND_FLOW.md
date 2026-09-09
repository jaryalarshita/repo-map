# 🗺️ Backend Flow — Complete Detailed Guide

> This document explains **every step** that happens in the backend when a user submits a GitHub repo URL, from the moment the request arrives to the moment the 3D graph data is returned.

---

## 📁 Project Structure

```
backend/
├── server.js                    ← Entry point — starts Express, registers middleware
├── routes/
│   └── api.js                   ← All API endpoints (analyze, stream, summary, ping)
├── services/
│   ├── githubService.js         ← Downloads repo ZIP from GitHub API
│   ├── parserService.js         ← Scans files, extracts dependencies, builds graph
│   └── deepmindService.js       ← Calls Gemini AI for file summaries (on-click)
├── parser/
│   ├── main.cpp                 ← (Legacy) Original C++ parser — no longer used
│   └── Makefile                 ← (Legacy) Build script for C++ parser
├── schema.json                  ← Reference schema showing the expected JSON shape
├── package.json                 ← Dependencies & scripts
├── .env.example                 ← Environment variable template
└── DEPLOY.md                    ← Deployment instructions
```

---

## 🔄 High-Level Flow (The Big Picture)

```
┌──────────────────┐
│  React Frontend  │
│  (localhost:5173) │
└────────┬─────────┘
         │  User enters a GitHub URL and clicks "Enter"
         │
         ▼
┌──────────────────────────────────────────────────┐
│  GET /api/analyze/stream?url=<github_url>        │  ← SSE (Server-Sent Events)
│                                                  │
│  Step 1: Validate the URL                        │
│  Step 2: Download repo as ZIP from GitHub API    │  → githubService.js
│  Step 3: Parse all files & extract dependencies  │  → parserService.js
│  Step 4: Stream the graph JSON back to frontend  │
│  Step 5: Cleanup temp files from disk            │
└──────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│  3D Graph Renders│
│  in the browser  │
└────────┬─────────┘
         │  User clicks on a node (file sphere)
         │
         ▼
┌──────────────────────────────────────────────────┐
│  GET /api/summary?path=<file_path>               │
│                                                  │
│  Reads the file → Sends to Gemini AI → Returns   │  → deepmindService.js
│  a 2-sentence summary                            │
└──────────────────────────────────────────────────┘
```

---

## 🚀 Step-by-Step Walkthrough

### Phase 0: Server Startup (`server.js`)

When you run `npm run dev`, Node.js executes `server.js`:

```
1. Load environment variables from .env  (dotenv.config())
2. Create the Express app
3. Register middleware IN ORDER:
   a. cors()          ← Allows frontend (port 5173) to call backend (port 3001)
   b. express.json()  ← Parses incoming JSON request bodies
4. Mount all API routes under /api prefix
5. Start listening on PORT 3001
6. Set keepAliveTimeout & headersTimeout to 120 seconds (for long SSE connections)
```

**Why CORS first?** If CORS middleware runs after a route, the browser will block that request before it even reaches the route logic.

---

### Phase 1: URL Validation (`routes/api.js`)

When the frontend sends a request to `GET /api/analyze/stream?url=https://github.com/owner/repo`:

```
1. The request logger middleware logs: [timestamp] GET /analyze/stream
2. Extract the 'url' query parameter
3. Validate:
   ├── Is it missing? → Send SSE error event with code 400
   └── Does it NOT start with "https://github.com/"? → Send SSE error event with code 400
4. Set SSE response headers:
   ├── Content-Type: text/event-stream
   ├── Cache-Control: no-cache
   └── Connection: keep-alive
5. Flush headers to establish SSE connection immediately
6. Send first progress event: "Connecting to GitHub..."
```

---

### Phase 2: Download Repository (`services/githubService.js`)

The `downloadAndExtract(githubUrl)` function runs:

```
Step 2.1 — Parse the URL
  Input:  "https://github.com/facebook/react"
  Output: owner = "facebook", repo = "react"
  Note:   Strips trailing ".git" if present

Step 2.2 — Call the GitHub API
  Endpoint:     GET https://api.github.com/repos/facebook/react/zipball
  Headers:      User-Agent: "CodebaseMap-Hackathon"
  ResponseType: arraybuffer (raw binary bytes — ZIP is binary, not text)
  MaxRedirects: 5 (GitHub redirects to a CDN for the actual download)

  If 404 → Throw "Repository not found or is private"
  If other error → Throw "GitHub download failed: <message>"

Step 2.3 — Save to temp directory
  Path: C:\Users\...\AppData\Local\Temp\repo-<timestamp>.zip
  The raw arraybuffer bytes are written using fs.writeFileSync()

Step 2.4 — Extract the ZIP
  Uses adm-zip (pure JS library — no system 'unzip' needed)
  Extracts to: C:\Users\...\AppData\Local\Temp\repo-<timestamp>\

Step 2.5 — Find repo folder inside extraction
  GitHub wraps content in a folder like "facebook-react-abc1234/"
  The service finds that inner directory and returns its path

Returns: { zipPath, extractedDir }
```

**Why ZIP instead of `git clone`?**
- `git clone` needs git installed on the server
- `git clone` downloads the entire history (very slow for large repos)
- ZIP = single HTTP request, only latest files

**Why ZIP instead of GitHub Trees API?**
- Trees API = 1 API call per file to get its content
- A 2,000-file repo = 2,000 API calls = rate-limited instantly
- ZIP = 1 request gets everything

---

### Phase 3: Parse Dependencies (`services/parserService.js`)

The `runParser(extractedDir)` function runs entirely in Node.js:

```
Step 3.1 — Walk the directory tree (recursively)
  ├── Skips: node_modules/, hidden files/folders (starting with '.')
  ├── Only processes files with supported extensions:
  │     .js, .jsx, .ts, .tsx, .cpp, .cc, .h, .hpp, .py
  └── For each supported file, creates a NODE:
        {
          id:      "src/components/App.jsx"    ← relative path (forward slashes)
          label:   "App.jsx"                   ← filename only (for display)
          size:    8-30                        ← based on file size (bigger file = bigger sphere)
          summary: null                        ← filled later by AI on-click
        }

Step 3.2 — Parse dependencies for each file
  Based on file extension, uses the appropriate parser:

  ┌──────────────────────────────────────────────────────────────┐
  │  JavaScript/TypeScript (.js, .jsx, .ts, .tsx)               │
  │  ─────────────────────────────────────────────               │
  │  Detects two patterns line-by-line:                         │
  │    1. import ... from './path'                              │
  │    2. const x = require('./path')                           │
  │  Uses string.indexOf() for speed (no regex overhead)        │
  ├──────────────────────────────────────────────────────────────┤
  │  C/C++ (.cpp, .cc, .h, .hpp)                               │
  │  ───────────────────────────                                │
  │  Detects:  #include "header.h"                              │
  │  Ignores:  #include <system>  (angle brackets = system lib) │
  ├──────────────────────────────────────────────────────────────┤
  │  Python (.py)                                               │
  │  ────────────                                               │
  │  Detects two patterns:                                      │
  │    1. from module import something                          │
  │    2. import module                                         │
  └──────────────────────────────────────────────────────────────┘

Step 3.3 — Filter and resolve dependencies
  For each detected dependency:
    1. Skip if it's an npm package (no ./ or ../ prefix, e.g., "react")
    2. Skip if it's a scoped package (starts with "@", e.g., "@babel/core")
    3. Skip if it contains "node_modules"
    4. Resolve the relative path against the importing file's directory
    5. Try adding common extensions to match a known node:
         dep → dep.js → dep.jsx → dep.ts → dep.tsx → dep/index.js → dep/index.tsx
    6. If a matching node is found, create a LINK:
         { source: "src/App.jsx", target: "src/utils/helpers.js" }

Step 3.4 — Clean up and return
  Remove the temporary fullPath property from each node
  Return: { nodes: [...], links: [...] }
```

---

### Phase 4: Return Result to Frontend (`routes/api.js`)

Back in the SSE stream handler:

```
1. Send SSE event: "Building 3D graph..."
2. Send SSE 'result' event containing the full { nodes, links } JSON
3. The frontend receives this and renders it as a 3D force-directed graph
```

---

### Phase 5: Cleanup (`services/parserService.js`)

The `cleanupFiles(zipPath, extractedDir)` function runs in the `finally` block:

```
1. Delete the .zip file from temp directory
2. Delete the extracted folder (and all contents recursively)
   └── Goes up one level to delete the parent "repo-<timestamp>" folder entirely
3. Errors are logged but NEVER thrown — cleanup failure shouldn't crash the server
```

**Why is cleanup critical?** Without it, 20 demo requests = 20 unzipped repos sitting in temp = full disk = server crash.

---

### Phase 6: AI Summary (Separate Endpoint) (`services/deepmindService.js`)

When the user **clicks a file node** in the 3D graph, the frontend calls:

```
GET /api/summary?path=/absolute/path/to/file.js
```

The flow:

```
1. Read the file from disk using fs.readFileSync()
2. Truncate content to first 3000 characters (to stay within token limits)
3. Build a prompt:
   "You are a senior software engineer. In exactly 2 sentences, describe
    what the following file does in plain English..."
4. Call Google Gemini AI (gemini-1.5-flash model) via the SDK
5. Return: { summary: "This file does X. It handles Y." }

Error policy: NEVER throws. Always returns a string.
  - If API key is missing → "Summary unavailable: API key not configured"
  - If API call fails     → "Summary unavailable: <error message>"
```

**Why only on-click?** Pre-fetching summaries for all nodes would fire hundreds of API calls and exhaust the free tier instantly.

---

## 📡 API Endpoints Reference

| Method | Endpoint | Purpose | Input | Output |
|--------|----------|---------|-------|--------|
| `GET` | `/api/analyze/ping` | Health check | None | `{ status: "ok", timestamp: "..." }` |
| `GET` | `/api/analyze/stream` | SSE: Download → Parse → Stream result | `?url=https://github.com/owner/repo` | SSE events: `progress`, `result`, `error` |
| `POST` | `/api/analyze` | Same as stream but as a single JSON response | `{ "url": "https://github.com/owner/repo" }` | `{ nodes: [...], links: [...] }` |
| `GET` | `/api/summary` | AI summary for one file | `?path=/absolute/path/to/file.js` | `{ summary: "This file does..." }` |

---

## 📦 Output Data Schema

The backend returns this JSON structure (consumed by `react-force-graph-3d` on the frontend):

```json
{
  "nodes": [
    {
      "id": "src/index.js",          // Relative path — unique identifier
      "label": "index.js",           // Display name for the 3D label
      "size": 15,                    // Sphere size (8-30, scaled by file size)
      "summary": null                // Null initially, filled by /api/summary on click
    }
  ],
  "links": [
    {
      "source": "src/index.js",      // The file that has the import statement
      "target": "src/components/App.jsx"  // The file being imported
    }
  ]
}
```

---

## 🔧 Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | Port the Express server listens on |
| `DEEPMIND_API_KEY` | `your_key_here` | Google Gemini API key for AI summaries |

---

## 📚 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^5.2.1 | HTTP server framework |
| `cors` | ^2.8.6 | Cross-origin resource sharing |
| `axios` | ^1.13.6 | HTTP client to download ZIP from GitHub API |
| `adm-zip` | ^0.5.16 | Pure-JS ZIP extraction (no system `unzip` needed) |
| `dotenv` | ^17.3.1 | Load `.env` file into `process.env` |
| `@google/generative-ai` | ^0.24.1 | Official Google Gemini SDK for AI summaries |

---

## 🔁 Complete Request Lifecycle Diagram

```
FRONTEND                           BACKEND
────────                           ───────
User enters URL
     │
     ├─GET /api/analyze/stream──→  api.js validates URL
     │                                │
     │  ◄── SSE: "Connecting..."      │
     │                                ├─→ githubService.downloadAndExtract()
     │                                │      │
     │                                │      ├─ Parse URL → owner/repo
     │                                │      ├─ GET github.com/.../zipball
     │                                │      ├─ Save ZIP to temp
     │                                │      ├─ Extract with adm-zip
     │                                │      └─ Return { zipPath, extractedDir }
     │                                │
     │  ◄── SSE: "Parsing deps..."    │
     │                                ├─→ parserService.runParser()
     │                                │      │
     │                                │      ├─ Walk directory recursively
     │                                │      ├─ Create nodes for each code file
     │                                │      ├─ Parse imports/requires/#includes
     │                                │      ├─ Create links between files
     │                                │      └─ Return { nodes, links }
     │                                │
     │  ◄── SSE: "Building graph..."  │
     │  ◄── SSE: result { nodes,links}│
     │                                │
     │                                ├─→ parserService.cleanupFiles()
     │                                │      └─ Delete ZIP + extracted folder
     │                                │
     │  ◄── SSE: connection closed    │
     │
3D Graph renders
     │
User clicks a node
     │
     ├─GET /api/summary?path=...──→  api.js reads file
     │                                │
     │                                ├─→ deepmindService.generateSummary()
     │                                │      ├─ Truncate to 3000 chars
     │                                │      ├─ Call Gemini AI
     │                                │      └─ Return summary string
     │                                │
     │  ◄── { summary: "..." }        │
     │
Sidebar shows summary
```

---

*This document was generated to explain the complete backend architecture of the Repo-Map project.*
