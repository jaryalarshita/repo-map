import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import useStore from '../store/useStore';
import { analyzeRepo } from '../services/api';

/**
 * Hero search card — the first thing the user sees.
 *
 * Accepts a GitHub URL, validates it, streams the analysis via SSE,
 * and pushes results into the global Zustand store.
 */
export default function SearchBar() {
  const [url, setUrl] = useState('');
  const [validationError, setValidationError] = useState('');

  const isLoading = useStore((state) => state.isLoading);
  const setLoading = useStore((state) => state.setLoading);
  const setGraphData = useStore((state) => state.setGraphData);
  const setError = useStore((state) => state.setError);
  const setGithubUrl = useStore((state) => state.setGithubUrl);

  /** Validate & kick off analysis. */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    // Client-side validation
    if (!url.trim().startsWith('https://github.com/')) {
      setValidationError(
        'Please enter a valid GitHub URL (https://github.com/owner/repo)',
      );
      return;
    }

    try {
      setLoading(true, 'Connecting to GitHub…');
      const cleanUrl = url.trim();
      setGithubUrl(cleanUrl);

      const data = await analyzeRepo(cleanUrl, (msg) =>
        setLoading(true, msg),
      );

      setGraphData(data);
    } catch (err) {
      setError(err.code || 500, err.message || 'Analysis failed');
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-dark-base">
      {/* Subtle radial glow behind the card */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-15"
          style={{
            background:
              'radial-gradient(circle, rgba(0,245,255,0.25) 0%, transparent 70%)',
          }}
        />
      </div>

      <form
        onSubmit={handleSubmit}
        className="glass glow-cyan relative w-full max-w-xl mx-4 p-8 flex flex-col items-center gap-6"
      >
        {/* ── Headline ── */}
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-center glow-text text-neon-cyan">
          Map Your Codebase
        </h1>
        <p className="text-gray-400 text-sm -mt-3 text-center">
          Paste a GitHub URL to explore its dependency graph in 3D
        </p>

        {/* ── Input ── */}
        <div className="w-full">
          <div className="flex gap-2">
            <input
              id="github-url-input"
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (validationError) setValidationError('');
              }}
              placeholder="https://github.com/owner/repo"
              disabled={isLoading}
              className="flex-1 rounded-lg bg-dark-surface border border-white/10 px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/40 transition-colors disabled:opacity-50"
            />

            <button
              id="analyze-btn"
              type="submit"
              disabled={isLoading}
              className="flex items-center justify-center gap-2 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 px-5 py-3 font-semibold text-neon-cyan hover:bg-neon-cyan/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Search className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Inline validation error */}
          {validationError && (
            <p className="mt-2 text-sm text-red-400">{validationError}</p>
          )}
        </div>

        {/* ── Hint ── */}
        <p className="text-xs text-gray-600 text-center">
          Works with any public GitHub repository
        </p>
      </form>
    </div>
  );
}
