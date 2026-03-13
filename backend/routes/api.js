// =============================================================================
// routes/api.js — API Route Definitions (MOCK VERSION)
// =============================================================================
// Returns hardcoded graph data matching schema.json so the frontend team can
// build and test the 3D visualization without waiting for the real parser.
// Will be replaced with real implementation in Prompt 8.
// =============================================================================

const express = require('express');
const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/analyze/ping — Health Check
// ---------------------------------------------------------------------------
router.get('/analyze/ping', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// ---------------------------------------------------------------------------
// POST /api/analyze — MOCK: Returns hardcoded graph data
// ---------------------------------------------------------------------------
router.post('/analyze', (req, res) => {
  console.log(`[MOCK] /api/analyze called with URL: ${req.body.url || 'none'}`);

  // Hardcoded mock data matching schema.json format exactly.
  // 5 nodes and 4 links using realistic JS filenames.
  const mockGraph = {
    nodes: [
      {
        id: 'src/index.js',
        label: 'index.js',
        size: 18,
        summary: null
      },
      {
        id: 'src/components/App.jsx',
        label: 'App.jsx',
        size: 15,
        summary: null
      },
      {
        id: 'src/components/Header.jsx',
        label: 'Header.jsx',
        size: 10,
        summary: null
      },
      {
        id: 'src/utils/helpers.js',
        label: 'helpers.js',
        size: 8,
        summary: null
      },
      {
        id: 'src/hooks/useAuth.js',
        label: 'useAuth.js',
        size: 12,
        summary: null
      }
    ],
    links: [
      { source: 'src/index.js', target: 'src/components/App.jsx' },
      { source: 'src/components/App.jsx', target: 'src/components/Header.jsx' },
      { source: 'src/components/App.jsx', target: 'src/utils/helpers.js' },
      { source: 'src/components/App.jsx', target: 'src/hooks/useAuth.js' }
    ]
  };

  res.json(mockGraph);
});

module.exports = router;
