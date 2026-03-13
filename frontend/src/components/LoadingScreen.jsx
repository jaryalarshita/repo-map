import useStore from '../store/useStore';

/**
 * Full-screen loading overlay.
 *
 * Displays an animated spinner ring and the current `loadingMessage`
 * from the Zustand store while the backend processes a repository.
 */
export default function LoadingScreen() {
  const loadingMessage = useStore((state) => state.loadingMessage);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-dark-base/95 backdrop-blur-sm">
      {/* ── Spinning ring ── */}
      <div className="relative h-24 w-24 mb-8">
        {/* Outer glow */}
        <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-neon-cyan" />
        {/* Spinning ring */}
        <div
          className="h-24 w-24 rounded-full animate-spin"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0%, #00f5ff 30%, transparent 60%)',
            WebkitMask:
              'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
          }}
        />
      </div>

      {/* ── Progress message ── */}
      <p className="text-xl font-semibold text-neon-cyan glow-text mb-3 text-center px-6">
        {loadingMessage || 'Initializing…'}
      </p>

      {/* ── Hint ── */}
      <p className="text-sm text-gray-500 text-center px-6">
        This may take 30–60 seconds for large repositories
      </p>
    </div>
  );
}
