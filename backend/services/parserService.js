// =============================================================================
// services/parserService.js — C++ Parser Bridge (Stub)
// =============================================================================
// Will be implemented in Prompt 6.
// Spawns the compiled C++ binary, passes it a directory path, and captures
// the JSON output from stdout.
// =============================================================================

module.exports = {
  runParser: async (extractedDir) => {
    throw new Error('parserService.runParser not yet implemented');
  },
  cleanupFiles: (zipPath, extractedDir) => {
    // Will use fs.rmSync to delete temp files
  }
};
