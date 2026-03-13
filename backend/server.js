// =============================================================================
// server.js — Main Express Entry Point
// =============================================================================
// Initializes the Express server and mounts CORS + API routes.
// CORS is registered FIRST to ensure cross-origin requests from the React
// frontend (running on a different port) are never blocked by the browser.
// =============================================================================

const express = require('express');
const cors = require('cors');

// Load environment variables from .env file
require('dotenv').config();

const apiRoutes = require('./routes/api');

const app = express();

// ---------------------------------------------------------------------------
// Middleware — ORDER MATTERS
// ---------------------------------------------------------------------------

// 1. CORS — MUST be before any route definitions.
//    Our React frontend runs on localhost:5173 (Vite default),
//    our backend on localhost:3001. Without this, browsers block the requests.
app.use(cors());

// 2. Parse incoming JSON request bodies (needed for POST /api/analyze)
app.use(express.json());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Mount all API routes under the /api prefix
app.use('/api', apiRoutes);

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/analyze/ping`);
  console.log(`   Analyze:      POST http://localhost:${PORT}/api/analyze\n`);
});
