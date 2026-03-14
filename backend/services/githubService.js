// =============================================================================
// services/githubService.js — GitHub ZIP Downloader
// =============================================================================
// Downloads a public GitHub repository as a .zip archive via a single HTTP
// request and extracts it into a temporary local directory using adm-zip.
//
// WHY ZIP instead of git clone?
//   - git clone requires git installed on the server
//   - git clone transfers entire git history (slow for large repos)
//   - ZIP is a single HTTP request containing only the latest files
//
// WHY ZIP instead of Trees API?
//   - Trees API requires one request per file for contents
//   - A 2,000-file repo = 2,000 API calls = instant rate limit
//   - ZIP = 1 request, all files, no rate limit worries
// =============================================================================

const axios = require('axios');
const AdmZip = require('adm-zip');
const path = require('path');
const os = require('os');
const fs = require('fs');

/**
 * Downloads a GitHub repo as a .zip and extracts it locally.
 *
 * @param {string} githubUrl - Full GitHub URL, e.g. "https://github.com/facebook/react"
 * @returns {Promise<{zipPath: string, extractedDir: string}>} Paths to the zip and extracted folder
 */
async function downloadAndExtract(githubUrl) {
  // -------------------------------------------------------------------------
  // Step 1: Parse the GitHub URL to extract owner and repo name
  // -------------------------------------------------------------------------
  // For "https://github.com/facebook/react", we need owner="facebook", repo="react"
  const urlObj = new URL(githubUrl);
  const pathParts = urlObj.pathname.split('/').filter(Boolean);

  if (pathParts.length < 2) {
    throw new Error('Invalid GitHub URL. Expected format: https://github.com/owner/repo');
  }

  const owner = pathParts[0];
  let repo = pathParts[1];
  if (repo.endsWith('.git')) {
    repo = repo.slice(0, -4);
  }

  console.log(`[GitHub] Downloading ${owner}/${repo}...`);

  // -------------------------------------------------------------------------
  // Step 2: Download the ZIP archive from GitHub
  // -------------------------------------------------------------------------
  // GitHub's zipball API: GET /repos/{owner}/{repo}/zipball
  // If no branch is provided, GitHub returns the zipball for the default branch (main/master).
  // responseType: 'arraybuffer' tells axios to keep raw bytes (ZIP is binary).
  let response;
  try {
    response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/zipball`,
      {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'CodebaseMap-Hackathon', // GitHub API requires a User-Agent
          'Accept': 'application/vnd.github+json'
        },
        maxRedirects: 5 // GitHub redirects to a CDN URL for the actual download
      }
    );
  } catch (err) {
    if (err.response && err.response.status === 404) {
      throw new Error('Repository not found or is private');
    }
    throw new Error(`GitHub download failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // Step 3: Generate unique temp directory and save the ZIP
  // -------------------------------------------------------------------------
  // os.tmpdir() returns the system temp folder (/tmp on Linux/Mac).
  // Date.now() ensures unique names if multiple requests arrive simultaneously.
  const tmpDir = path.join(os.tmpdir(), `repo-${Date.now()}`);
  const zipPath = tmpDir + '.zip';

  // Write the raw bytes to a .zip file
  // Buffer.from() converts the arraybuffer into a Node.js Buffer for fs.writeFileSync
  fs.writeFileSync(zipPath, Buffer.from(response.data));
  console.log(`[GitHub] ZIP saved to ${zipPath} (${(response.data.byteLength / 1024 / 1024).toFixed(2)} MB)`);

  // -------------------------------------------------------------------------
  // Step 4: Extract the ZIP into the temp directory
  // -------------------------------------------------------------------------
  // adm-zip is a pure JavaScript ZIP library — no system 'unzip' command needed.
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(tmpDir, /* overwrite */ true);

  console.log(`[GitHub] Extracted to ${tmpDir}`);

  // -------------------------------------------------------------------------
  // Step 5: Find the actual repo folder inside the extracted directory
  // -------------------------------------------------------------------------
  // GitHub wraps the repo contents in a folder like "owner-repo-commithash/".
  // We need to find that inner folder so the C++ parser gets the right path.
  const innerFolders = fs.readdirSync(tmpDir).filter(f =>
    fs.statSync(path.join(tmpDir, f)).isDirectory()
  );

  // The actual repo content is inside the first (and only) subdirectory
  const repoDir = innerFolders.length > 0
    ? path.join(tmpDir, innerFolders[0])
    : tmpDir;

  console.log(`[GitHub] Repo content at: ${repoDir}`);

  return {
    zipPath,            // Path to the .zip file (for cleanup)
    extractedDir: repoDir  // Path to the actual repo files (for the C++ parser)
  };
}

module.exports = { downloadAndExtract };
