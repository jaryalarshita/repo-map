import { AlertCircle } from 'lucide-react';
import useStore, {
  selectIsLoading,
  selectError,
  selectGraphData,
} from './store/useStore';

import SearchBar from './components/SearchBar';
import Graph3D from './components/Graph3D';
import Sidebar from './components/Sidebar';
import FileSearch from './components/FileSearch';
import LoadingScreen from './components/LoadingScreen';
import ControlPanel from './components/ControlPanel';

// ─── ErrorOverlay (internal) ───────────────────────────────────

function ErrorOverlay({ error, onDismiss, hasGraph }) {
  const hints = {
    404: 'Make sure the repository is public and the URL is correct.',
    429: 'GitHub rate limit hit. Wait 60 seconds and try again.',
    413: 'Repository is too large. Try a smaller project first.',
    500: 'Backend error. Make sure the server is running.',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-base/90 backdrop-blur-sm">
      <div className="glass glow-cyan w-full max-w-md mx-4 p-8 flex flex-col items-center gap-5 text-center">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <h2 className="text-xl font-bold text-white">{error.message}</h2>
        {hints[error.code] && (
          <p className="text-sm text-gray-400">{hints[error.code]}</p>
        )}
        <div className="flex gap-3 mt-2">
          <button
            onClick={onDismiss}
            className="rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 px-5 py-2.5 text-sm font-semibold text-neon-cyan hover:bg-neon-cyan/20 transition-colors"
          >
            Try Again
          </button>
          {hasGraph && (
            <button
              onClick={onDismiss}
              className="rounded-lg bg-white/5 border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/10 transition-colors"
            >
              Back to Graph
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── App ───────────────────────────────────────────────────────

export default function App() {
  const isLoading = useStore(selectIsLoading);
  const error = useStore(selectError);
  const graphData = useStore(selectGraphData);
  const clearError = useStore((s) => s.clearError);

  const hasGraph = graphData.nodes.length > 0;

  return (
    <div className="w-screen h-screen bg-dark-base overflow-hidden relative">
      {/* Always render graph if data exists so it doesn't unmount */}
      {hasGraph && (
        <>
          <Graph3D />
          <FileSearch />
          <Sidebar />
          <ControlPanel />
        </>
      )}

      {/* Overlay states — sit on top of the graph */}
      {!hasGraph && !isLoading && !error && <SearchBar />}
      {isLoading && <LoadingScreen />}
      {error && (
        <ErrorOverlay
          error={error}
          onDismiss={clearError}
          hasGraph={hasGraph}
        />
      )}
    </div>
  );
}
