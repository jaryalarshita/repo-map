// =============================================================================
// services/deepmindService.js — Google Deepmind AI Summary Service
// =============================================================================
// Calls the Gemini Flash API to generate 2-sentence plain English summaries
// of code files. Uses gemini-1.5-flash for speed and low cost.
//
// ⚠️  RATE LIMIT WARNING:
//   The frontend must ONLY call this endpoint when a user explicitly clicks
//   a file node in the 3D graph. NEVER pre-fetch summaries for all nodes
//   during the initial /api/analyze load — this would fire hundreds of API
//   calls and exhaust the free tier instantly.
//
// ERROR POLICY:
//   This service NEVER throws. It always returns a string.
//   The summary feature is a nice-to-have — if the API is down or rate-limited,
//   the 3D graph still works fine. Throwing would crash the whole request.
// =============================================================================

const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Generates a 2-sentence plain English summary of a code file using Gemini.
 *
 * @param {string} fileContent - The raw source code of the file
 * @param {string} filePath    - The file's path (used in the prompt for context)
 * @returns {Promise<string>}  - Always returns a string, never throws
 */
async function generateSummary(fileContent, filePath) {
  // -------------------------------------------------------------------------
  // Step 1: Check for API key
  // -------------------------------------------------------------------------
  const apiKey = process.env.DEEPMIND_API_KEY;
  console.log('DEBUG API KEY:', apiKey);

  if (!apiKey || apiKey === 'your_key_here') {
    return 'Summary unavailable: API key not configured. Set DEEPMIND_API_KEY in .env';
  }

  // -------------------------------------------------------------------------
  // Step 2: Initialize the Gemini client
  // -------------------------------------------------------------------------
  // GoogleGenerativeAI is the official SDK from Google.
  // We initialize it here (not at module level) so it picks up env changes.
  const genAI = new GoogleGenerativeAI(apiKey);

  // gemini-2.5-flash: fast, cheap, perfect for hackathon summaries.
  // gemini-2.5-pro is smarter but slower and more expensive.
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // -------------------------------------------------------------------------
  // Step 3: Build the prompt
  // -------------------------------------------------------------------------
  // Truncate file content to first 3000 characters to avoid token limits.
  // Most files reveal their purpose in the first ~100 lines anyway.
  const truncatedContent = fileContent.slice(0, 3000);

  const prompt = `You are a senior software engineer. In exactly 2 sentences, describe what the following file does in plain English. Be specific about its purpose and main functionality. File: ${filePath}\n\nCode:\n${truncatedContent}`;

  // -------------------------------------------------------------------------
  // Step 4: Call the API and extract the response
  // -------------------------------------------------------------------------
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();

    return summary.trim();
  } catch (err) {
    // Never throw — return a user-friendly error string instead.
    // Common failures: rate limit, invalid key, network timeout.
    console.error(`[Deepmind] Summary failed for ${filePath}: ${err.message}`);
    return 'Summary unavailable: ' + err.message;
  }
}

module.exports = { generateSummary };
