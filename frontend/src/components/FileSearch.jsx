import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import useStore, { selectGraphData } from '../store/useStore';

/**
 * Floating pill-shaped search bar at the top-center of the screen.
 *
 * Debounced filtering of graph nodes with a dropdown of up to 8 results.
 * Clicking a result flies the camera to that node and opens the sidebar.
 */
export default function FileSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef();

  const graphData = useStore(selectGraphData);
  const focusNode = useStore((s) => s.focusNode);
  const setSelectedNode = useStore((s) => s.setSelectedNode);

  // ── Clear when query empty ──
  useEffect(() => {
    if (!query.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      setIsOpen(false);
    }
  }, [query]);

  // ── Debounced filter (300 ms) ──
  useEffect(() => {
    if (!query.trim()) return;

    const timer = setTimeout(() => {
      const q = query.toLowerCase();
      const filtered = graphData.nodes
        .filter((n) => (n.id || '').toLowerCase().includes(q))
        .slice(0, 8);
      setResults(filtered);
      setIsOpen(filtered.length > 0);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, graphData.nodes]);

  // ── Escape key to close ──
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setQuery('');
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  /** Highlight the matching substring in a filename. */
  const highlightMatch = (text) => {
    const q = query.toLowerCase();
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="text-neon-cyan font-semibold">
          {text.slice(idx, idx + q.length)}
        </span>
        {text.slice(idx + q.length)}
      </>
    );
  };

  /** Extract just the filename from a path. */
  const basename = (path = '') => path.split('/').pop();

  return (
    <div
      className="fixed top-6 left-1/2 -translate-x-1/2 z-50"
      style={{ minWidth: 320 }}
    >
      {/* ── Search input ── */}
      <div className="glass flex items-center gap-2 px-4 py-2.5 rounded-full">
        <Search className="h-4 w-4 text-gray-500 shrink-0" />
        <input
          ref={inputRef}
          id="file-search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search files..."
          className="bg-transparent outline-none text-sm text-white placeholder-gray-500 w-full"
        />
      </div>

      {/* ── Results dropdown ── */}
      {isOpen && (
        <div className="glass mt-2 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
          {results.map((node) => (
            <button
              key={node.id}
              onClick={() => {
                focusNode(node);
                setSelectedNode(node);
                setQuery('');
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
            >
              <p className="text-sm text-white truncate">
                {highlightMatch(basename(node.id))}
              </p>
              <p className="text-xs text-gray-500 truncate">{node.id}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
