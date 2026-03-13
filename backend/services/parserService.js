// =============================================================================
// services/parserService.js — Node.js ↔ C++ Parser Bridge
// =============================================================================
// Spawns the compiled C++ binary as a child process, passes it the directory
// path of the unzipped repository, and captures the JSON output from stdout.
//
// WHY spawn() instead of exec()?
//   exec() buffers ALL stdout in memory with a default 200KB limit.
//   A large repo with 1,000+ files can output 2MB+ of JSON — exec() would
//   throw "stdout maxBuffer exceeded" and crash. spawn() streams data in
//   chunks with NO size limit, so it handles repos of any size.
//
// WHY buffer stdout chunks manually?
//   spawn() emits data in arbitrary-sized chunks (could be 1KB or 64KB).
//   We collect all chunks in an array, then Buffer.concat() them at the end
//   to get one clean JSON string for JSON.parse().
// =============================================================================

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Invokes the compiled C++ parser binary on a local directory.
 *
 * @param {string} extractedDir - Absolute path to the unzipped repo folder
 * @returns {Promise<Object>} Parsed JSON graph { nodes: [...], links: [...] }
 */
async function runParser(extractedDir) {
  // -------------------------------------------------------------------------
  // Determine the path to the compiled C++ binary
  // -------------------------------------------------------------------------
  // __dirname is the 'services/' folder; the binary lives at '../parser/parser'
  const binaryPath = path.join(__dirname, '../parser/parser');

  // Verify the binary exists before attempting to spawn
  if (!fs.existsSync(binaryPath)) {
    throw new Error(
      'Parser binary not found at: ' + binaryPath +
      '\nRun: cd backend/parser && make'
    );
  }

  // -------------------------------------------------------------------------
  // Spawn the C++ binary and capture output
  // -------------------------------------------------------------------------
  return new Promise((resolve, reject) => {
    try {
      const child = spawn(binaryPath, [extractedDir]);

      const stdoutChunks = [];  // Collect stdout data chunks
      const stderrChunks = [];  // Collect stderr for error reporting

      // Stdout: the C++ binary prints its JSON here
      child.stdout.on('data', (data) => {
        stdoutChunks.push(data);
      });

      // Stderr: capture error messages from the C++ binary
      child.stderr.on('data', (data) => {
        stderrChunks.push(data);
      });

      // 'close' fires AFTER all stdout/stderr has been flushed.
      // Safer than 'exit' which can fire before streams are fully read.
      child.on('close', (exitCode) => {
        const stderr = Buffer.concat(stderrChunks).toString().trim();

        // Exit code 0 = success, anything else = failure
        if (exitCode !== 0) {
          reject(new Error('Parser failed (exit code ' + exitCode + '): ' + stderr));
          return;
        }

        // Check for empty output (e.g., empty repository)
        if (stdoutChunks.length === 0) {
          reject(new Error('Parser returned empty output'));
          return;
        }

        // Concatenate all stdout chunks into a single string and parse as JSON
        try {
          const output = Buffer.concat(stdoutChunks).toString();
          const parsed = JSON.parse(output);
          resolve(parsed);
        } catch (parseErr) {
          reject(new Error('Failed to parse C++ output as JSON: ' + parseErr.message));
        }
      });

      // 'error' fires if the binary cannot be spawned at all
      // (e.g., binary doesn't exist, permission denied)
      child.on('error', (err) => {
        reject(new Error('Parser binary not found. Run: cd backend/parser && make\n' + err.message));
      });

    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Cleans up temporary files (ZIP archive and extracted folder).
 * MUST be called even if parsing fails — a full disk crashes the entire server.
 *
 * @param {string} zipPath - Path to the downloaded .zip file
 * @param {string} extractedDir - Path to the extracted folder
 */
function cleanupFiles(zipPath, extractedDir) {
  try {
    // Delete the .zip file
    // force: true means "don't throw if the file doesn't exist"
    if (zipPath) {
      fs.rmSync(zipPath, { force: true });
      console.log(`[Cleanup] Deleted ZIP: ${zipPath}`);
    }
  } catch (err) {
    // Log but don't throw — cleanup failure shouldn't crash the server
    console.error(`[Cleanup] Failed to delete ZIP: ${err.message}`);
  }

  try {
    // Delete the extracted folder and ALL its contents
    // recursive: true is required for non-empty directories
    if (extractedDir) {
      // Go up one level to delete the parent tmp folder too
      // extractedDir might be /tmp/repo-123/owner-repo-hash/
      // We want to delete /tmp/repo-123/ entirely
      const parentDir = path.dirname(extractedDir);
      if (parentDir.includes('repo-')) {
        fs.rmSync(parentDir, { recursive: true, force: true });
        console.log(`[Cleanup] Deleted folder: ${parentDir}`);
      } else {
        fs.rmSync(extractedDir, { recursive: true, force: true });
        console.log(`[Cleanup] Deleted folder: ${extractedDir}`);
      }
    }
  } catch (err) {
    console.error(`[Cleanup] Failed to delete folder: ${err.message}`);
  }
}

module.exports = { runParser, cleanupFiles };
