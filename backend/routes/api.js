// =============================================================================
// routes/api.js — Real API Route Definitions
// =============================================================================
// Wires together all three services into the final endpoints:
//   POST /api/analyze  → download ZIP → C++ parse → cleanup → return JSON
//   GET  /api/summary  → read file → Deepmind AI → return 2-sentence summary
//   GET  /api/analyze/ping → health check
//
// CRITICAL PATTERNS:
//   - try/finally guarantees cleanup even when parsing fails
//   - Input validation returns 400 BEFORE any expensive operations
//   - Each error case returns a clean JSON error, never crashes the server
// =============================================================================

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const githubService = require('../services/githubService');
const parserService = require('../services/parserService');
const deepmindService = require('../services/deepmindService');

// ---------------------------------------------------------------------------
// Request Logger Middleware (applies to all /api routes)
// ---------------------------------------------------------------------------
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ---------------------------------------------------------------------------
// GET /api/analyze/ping — Health Check
// ---------------------------------------------------------------------------
// Quick smoke test to verify the server is alive.
// Usage: curl http://localhost:3001/api/analyze/ping
router.get('/analyze/ping', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// ---------------------------------------------------------------------------
// GET /api/analyze/stream — SSE Stream: Download → Parse → Return (real-time)
// ---------------------------------------------------------------------------
// Query: ?url=https://github.com/owner/repo
// Sends Server-Sent Events: progress, result, error
router.get('/analyze/stream', async (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Helper to send SSE events
  const send = (event, data) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  let zipPath = null;
  let extractedDir = null;

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

    // Flush headers to establish SSE connection immediately
    if (res.flushHeaders) {
      res.flushHeaders();
    }

    send('progress', { message: 'Connecting to GitHub...' });
    const downloadResult = await githubService.downloadAndExtract(githubUrl);
    zipPath = downloadResult.zipPath;
    extractedDir = downloadResult.extractedDir;

    send('progress', { message: 'Parsing dependencies...' });
    const graphData = await parserService.runParser(extractedDir);

    send('progress', { message: 'Building 3D graph...' });
    send('result', graphData);
  } catch (err) {
    send('error', { code: err.code || 500, message: err.message });
  } finally {
    res.end();
    parserService.cleanupFiles(zipPath, extractedDir);
  }
});

// ---------------------------------------------------------------------------
// POST /api/analyze — Full Pipeline: Download → Parse → Cleanup → Return
// ---------------------------------------------------------------------------
// Request body: { "url": "https://github.com/owner/repo" }
// Response: { "nodes": [...], "links": [...] }
router.post('/analyze', async (req, res) => {
  // -----------------------------------------------------------------------
  // Step 1: Input Validation
  // -----------------------------------------------------------------------
  const githubUrl = req.body.url;

  if (!githubUrl) {
    return res.status(400).json({ error: 'githubUrl is required. Send { "url": "https://github.com/owner/repo" }' });
  }

  if (!githubUrl.startsWith('https://github.com/')) {
    return res.status(400).json({ error: 'URL must start with https://github.com/' });
  }

  // Track paths for cleanup in the finally block
  let zipPath = null;
  let extractedDir = null;

  try {
    // ---------------------------------------------------------------------
    // Step 2: Download the repository as a ZIP and extract locally
    // ---------------------------------------------------------------------
    console.log(`[Analyze] Downloading ${githubUrl}...`);
    const downloadResult = await githubService.downloadAndExtract(githubUrl);
    zipPath = downloadResult.zipPath;
    extractedDir = downloadResult.extractedDir;

    console.log(`[Analyze] Extracted to ${extractedDir}`);

    // ---------------------------------------------------------------------
    // Step 3: Run the C++ parser on the extracted directory
    // ---------------------------------------------------------------------
    console.log(`[Analyze] Running C++ parser...`);
    const graphData = await parserService.runParser(extractedDir);

    console.log(`[Analyze] ✅ Parsed ${graphData.nodes.length} nodes and ${graphData.links.length} links`);

    // ---------------------------------------------------------------------
    // Step 4: Return the graph JSON to the frontend
    // ---------------------------------------------------------------------
    return res.status(200).json(graphData);

  } catch (err) {
    // Differentiate between download errors and parser errors
    console.error(`[Analyze] ❌ Error: ${err.message}`);

    if (err.message.includes('not found') || err.message.includes('private')) {
      return res.status(404).json({ error: err.message });
    }

    return res.status(500).json({
      error: 'Analysis failed',
      details: err.message
    });

  } finally {
    // -----------------------------------------------------------------
    // Step 5: ALWAYS clean up temp files — even if parsing crashed
    // -----------------------------------------------------------------
    // Without this, 20 demo requests = full disk = server crash
    parserService.cleanupFiles(zipPath, extractedDir);
  }
});

// ---------------------------------------------------------------------------
// GET /api/summary — On-Demand AI Summary for a Single File
// ---------------------------------------------------------------------------
// Query: ?path=/absolute/path/to/file.js
// Response: { "summary": "This file does X. It handles Y." }
//
// ⚠️ FRONTEND RULE: Only call this when a user CLICKS a node.
//    Never pre-fetch summaries for all nodes — that exhausts the API.
router.get('/summary', async (req, res) => {
  const filePath = req.query.path;

  if (!filePath) {
    return res.status(400).json({ error: 'path query parameter is required' });
  }

  // Read the file content
  let fileContent;
  try {
    fileContent = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    return res.status(404).json({ error: `File not found: ${filePath}` });
  }

  // Generate the AI summary (never throws — always returns a string)
  const summary = await deepmindService.generateSummary(fileContent, filePath);

  return res.status(200).json({ summary });
});

module.exports = router;
