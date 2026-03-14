import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import useStore, { selectGraphData } from '../store/useStore';

/**
 * Floating pill-shaped search bar at the top-center of the screen.
 *
 * Debounced filtering of graph nodes with a dropdown of up to 8 results.
 * Clicking a result flies the camera to that node and opens the sidebar.
 * Also highlights matching nodes in the 3D graph via searchHighlight.
 */
export default function FileSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef();

  const graphData = useStore(selectGraphData);
  const rawGraphData = useStore((s) => s.rawGraphData);
  const focusNode = useStore((s) => s.focusNode);
  const setSelectedNode = useStore((s) => s.setSelectedNode);
  const setSearchHighlight = useStore((s) => s.setSearchHighlight);

  // Clear when query empty
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      setSearchHighlight('');
    }
  }, [query, setSearchHighlight]);

  // Debounced filter (300 ms) — search across ALL nodes, not just visible
  useEffect(() => {
    if (!query.trim()) return;

    const timer = setTimeout(() => {
      const q = query.toLowerCase();
      const filtered = (rawGraphData?.nodes || [])
        .filter((n) => n.type === 'file' && (n.id || '').toLowerCase().includes(q))
        .slice(0, 8);
      setResults(filtered);
      setIsOpen(filtered.length > 0);
      setSearchHighlight(q);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, rawGraphData?.nodes, setSearchHighlight]);

  // Escape key to close
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setQuery('');
        setIsOpen(false);
        setSearchHighlight('');
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [setSearchHighlight]);

  /** Highlight the matching substring. */
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

  const basename = (p = '') => p.split('/').pop();

  /** Group badge color */
  const groupColor = (group) => {
    if (group === 'frontend') return '#4A90E2';
    if (group === 'backend') return '#FF6B6B';
    if (group === 'config') return '#9B59B6';
    return '#2ECC71';
  };

  return (
    <div
      className="fixed top-6 left-1/2 -translate-x-1/2 z-50"
      style={{ minWidth: 360 }}
    >
      {/* Search input */}
      <div className="glass flex items-center gap-2 px-4 py-2.5 rounded-full">
        <Search className="h-4 w-4 text-gray-500 shrink-0" />
        <input
          ref={inputRef}
          id="file-search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search files…"
          className="bg-transparent outline-none text-sm text-white placeholder-gray-500 w-full"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setSearchHighlight(''); }}
            className="text-gray-500 hover:text-white text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && (
        <div className="glass mt-2 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
          {results.map((node) => (
            <button
              key={node.id}
              onClick={() => {
                // Find the node in visible graph (may need to expand)
                const visibleNode = graphData.nodes.find((n) => n.id === node.id);
                if (visibleNode) {
                  focusNode(visibleNode);
                  setSelectedNode(visibleNode);
                } else {
                  setSelectedNode(node);
                }
                setQuery('');
                setIsOpen(false);
                setSearchHighlight('');
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0 flex items-center gap-3"
            >
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: groupColor(node.group) }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate">
                  {highlightMatch(basename(node.id))}
                </p>
                <p className="text-xs text-gray-500 truncate">{node.id}</p>
              </div>
              {node.lineCount && (
                <span className="text-[10px] text-gray-600 shrink-0">{node.lineCount}L</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
