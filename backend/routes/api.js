// =============================================================================
// routes/api.js — API Route Definitions (MOCK for now)
// =============================================================================
// Placeholder router. Will be fully implemented in Prompt 3 (mock) and
// Prompt 8 (real wiring). Exports a minimal router so server.js doesn't crash.
// =============================================================================

const express = require('express');
const router = express.Router();

// Health check — verifies the server is alive
router.get('/analyze/ping', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Placeholder — will be replaced in Prompt 3
router.post('/analyze', (req, res) => {
  res.json({ message: 'Analyze endpoint not yet implemented' });
});

module.exports = router;
