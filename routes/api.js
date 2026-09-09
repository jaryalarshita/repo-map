// =============================================================================
// routes/api.js — API Route Definitions
// =============================================================================
// Endpoints:
//   POST /api/analyze       → download ZIP → parse → cleanup → return JSON
//   GET  /api/analyze/stream → SSE version of above  
//   GET  /api/analyze/ping  → health check
//   GET  /api/summary       → AI summary for a file
//   GET  /api/file-content  → raw source code of a file from the last analyzed repo
// =============================================================================

const express = require('express');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const githubService = require('../services/githubService');
const parserService = require('../services/parserService');
const deepmindService = require('../services/deepmindService');

// ── Rate limiting ────────────────────────────────────────────────────────────
// /analyze and /analyze/stream are the expensive paths: each call downloads a
// full repo ZIP from GitHub and walks its entire file tree. Without a limit,
// one client can burn through GitHub's unauthenticated rate limit (60/hr) or
// fill the server's disk with concurrent downloads. Lighter, frequently-polled
// endpoints (ping, file-content, summary) are intentionally left unlimited.
const analyzeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many analysis requests. Please wait before trying again.' },
});

// ── State: keep the last analyzed repo on disk so /file-content works ──
let lastExtractedDir = null;
let lastZipPath = null;

function cleanupPrevious() {
  if (lastZipPath || lastExtractedDir) {
    parserService.cleanupFiles(lastZipPath, lastExtractedDir);
    lastZipPath = null;
    lastExtractedDir = null;
  }
}

// ── Logger ──────────────────────────────────────────────────────────────────
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── Health check ────────────────────────────────────────────────────────────
router.get('/analyze/ping', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// ── SSE Stream: Download → Parse → Return ───────────────────────────────────
router.get('/analyze/stream', analyzeLimiter, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (event, data) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const githubUrl = req.query.url;
    if (!githubUrl) {
      send('error', { code: 400, message: 'URL required' });
      return res.end();
    }
    if (!githubUrl.startsWith('https://github.com/')) {
      send('error', { code: 400, message: 'URL must start with https://github.com/' });
      return res.end();
    }

    if (res.flushHeaders) res.flushHeaders();

    // Clean up previous repo before downloading a new one
    cleanupPrevious();

    send('progress', { message: 'Connecting to GitHub...' });
    const downloadResult = await githubService.downloadAndExtract(githubUrl);
    lastZipPath = downloadResult.zipPath;
    lastExtractedDir = downloadResult.extractedDir;

    send('progress', { message: 'Parsing dependencies...' });
    const graphData = await parserService.runParser(lastExtractedDir);

    send('progress', { message: 'Building 3D graph...' });
    send('result', graphData);
  } catch (err) {
    send('error', { code: err.code || 500, message: err.message });
    cleanupPrevious();
  } finally {
    res.end();
    // NOTE: we do NOT clean up here — we keep files for /file-content
  }
});

// ── POST /api/analyze ───────────────────────────────────────────────────────
router.post('/analyze', analyzeLimiter, async (req, res) => {
  const githubUrl = req.body.url;
  if (!githubUrl) {
    return res.status(400).json({ error: 'githubUrl is required. Send { "url": "https://github.com/owner/repo" }' });
  }
  if (!githubUrl.startsWith('https://github.com/')) {
    return res.status(400).json({ error: 'URL must start with https://github.com/' });
  }

  try {
    cleanupPrevious();

    console.log(`[Analyze] Downloading ${githubUrl}...`);
    const downloadResult = await githubService.downloadAndExtract(githubUrl);
    lastZipPath = downloadResult.zipPath;
    lastExtractedDir = downloadResult.extractedDir;

    console.log(`[Analyze] Running parser...`);
    const graphData = await parserService.runParser(lastExtractedDir);
    console.log(`[Analyze] ✅ Parsed ${graphData.nodes.length} nodes and ${graphData.links.length} links`);

    return res.status(200).json(graphData);
  } catch (err) {
    console.error(`[Analyze] ❌ Error: ${err.message}`);
    cleanupPrevious();

    if (err.code === 413) {
      return res.status(413).json({ error: err.message });
    }
    if (err.message.includes('not found') || err.message.includes('private')) {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Analysis failed', details: err.message });
  }
});

// ── GET /api/file-content — Raw source code of a file ───────────────────────
// Query: ?path=src/components/App.jsx  (relative path from repo root)
// Returns: { content: "...", lineCount: 42, language: "jsx" }
router.get('/file-content', (req, res) => {
  const relPath = req.query.path;

  if (!relPath) {
    return res.status(400).json({ error: 'path query parameter is required' });
  }

  if (!lastExtractedDir) {
    return res.status(404).json({ error: 'No repository has been analyzed yet' });
  }

  // Prevent path traversal attacks
  const resolved = path.resolve(lastExtractedDir, relPath);
  if (!resolved.startsWith(path.resolve(lastExtractedDir) + path.sep)) {
    return res.status(403).json({ error: 'Path traversal not allowed' });
  }

  try {
    const content = fs.readFileSync(resolved, 'utf-8');
    const lineCount = content.split('\n').length;
    const ext = path.extname(relPath).replace('.', '');

    // Map extensions to language names for syntax display
    const langMap = {
      js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
      py: 'python', cpp: 'cpp', cc: 'cpp', h: 'c', hpp: 'cpp',
      json: 'json', md: 'markdown', css: 'css', html: 'html',
      yaml: 'yaml', yml: 'yaml',
    };

    return res.status(200).json({
      content: content.slice(0, 50000), // cap at 50KB for safety
      lineCount,
      language: langMap[ext] || ext || 'text',
    });
  } catch (err) {
    return res.status(404).json({ error: `File not found: ${relPath}` });
  }
});

// ── GET /api/summary — On-Demand AI Summary ─────────────────────────────────
// Query: ?path=src/utils/auth.js
// Response: { "summary": "This file does X. It handles Y." }
//
// ⚠️ FRONTEND RULE: Only call this when a user CLICKS a node.
//    Never pre-fetch summaries for all nodes — that exhausts the API.
router.get('/summary', async (req, res) => {
  const filePath = req.query.path;

  if (!filePath) {
    return res.status(400).json({ error: 'path query parameter is required' });
  }

  // Read only from inside the last extracted repo — never from an
  // arbitrary/absolute path supplied by the client (that was a file-read
  // vulnerability: ?path=/etc/passwd would previously be read and summarized).
  if (!lastExtractedDir) {
    return res.status(404).json({ error: 'No repository has been analyzed yet' });
  }

  const resolved = path.resolve(lastExtractedDir, filePath);
  if (!resolved.startsWith(path.resolve(lastExtractedDir) + path.sep)) {
    return res.status(403).json({ error: 'Path traversal not allowed' });
  }

  let fileContent;
  try {
    fileContent = fs.readFileSync(resolved, 'utf-8');
  } catch {
    return res.status(404).json({ error: `File not found: ${filePath}` });
  }

  const summary = await deepmindService.generateSummary(fileContent, filePath);
  return res.status(200).json({ summary });
});

module.exports = router;
