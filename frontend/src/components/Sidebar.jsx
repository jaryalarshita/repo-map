import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import useStore, { selectGraphData, selectSelectedNode } from '../store/useStore';
import { getFileSummary } from '../services/api';

/**
 * Right-side detail panel that slides in when a graph node is selected.
 *
 * Shows the file name, connection stats, clickable connected-file pills,
 * and an AI-generated file summary.
 */
export default function Sidebar() {
  const selectedNode = useStore(selectSelectedNode);
  const graphData = useStore(selectGraphData);
  const setSelectedNode = useStore((s) => s.setSelectedNode);
  const focusNode = useStore((s) => s.focusNode);

  // AI summary local state
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // ── Fetch AI summary when selected node changes ──
  useEffect(() => {
    if (!selectedNode?.id) {
      setSummary(null);
      return;
    }

    let cancelled = false;
    setSummaryLoading(true);
    setSummary(null);

    getFileSummary(selectedNode.id)
      .then((text) => {
        if (!cancelled) {
          setSummary(text);
          setSummaryLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSummary('Summary unavailable');
          setSummaryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedNode?.id]);

  // ── Connection helpers ──
  const imports = graphData.links.filter(
    (l) => (typeof l.source === 'object' ? l.source.id : l.source) === selectedNode?.id,
  );
  const importedBy = graphData.links.filter(
    (l) => (typeof l.target === 'object' ? l.target.id : l.target) === selectedNode?.id,
  );

  /** Resolve a link endpoint (could be an id string or an object). */
  const resolveNode = (endpoint) => {
    const id = typeof endpoint === 'object' ? endpoint.id : endpoint;
    return graphData.nodes.find((n) => n.id === id);
  };

  /** Extract just the filename from a path. */
  const basename = (path = '') => path.split('/').pop();

  // ── Gather unique connected node IDs ──
  const connectedIds = new Set();
  imports.forEach((l) => {
    const id = typeof l.target === 'object' ? l.target.id : l.target;
    connectedIds.add(id);
  });
  importedBy.forEach((l) => {
    const id = typeof l.source === 'object' ? l.source.id : l.source;
    connectedIds.add(id);
  });

  const connectedNodes = [...connectedIds]
    .map((id) => graphData.nodes.find((n) => n.id === id))
    .filter(Boolean);

  return (
    <div
      className="glass fixed right-0 top-0 h-screen w-[380px] z-50 flex flex-col overflow-y-auto p-6"
      style={{
        transform: selectedNode ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {selectedNode && (
        <>
          {/* ── Close button ── */}
          <button
            onClick={() => setSelectedNode(null)}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>

          {/* ── File heading ── */}
          <h2 className="text-xl font-bold text-neon-cyan glow-text mt-2 break-words">
            {basename(selectedNode.id)}
          </h2>
          <p className="text-xs text-gray-500 mt-1 break-all">
            {selectedNode.id}
          </p>

          {/* ── Divider ── */}
          <div className="h-px bg-white/10 my-5" />

          {/* ── Connections ── */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">
              Connections
            </h3>
            <p className="text-sm text-gray-400 mb-3">
              <span className="text-neon-cyan">↑ {imports.length}</span>{' '}
              imports{' '}
              <span className="text-neon-orange ml-2">↓ {importedBy.length}</span>{' '}
              imported by
            </p>

            <div className="flex flex-wrap gap-2">
              {connectedNodes.map((node) => (
                <button
                  key={node.id}
                  onClick={() => {
                    setSelectedNode(node);
                    focusNode(node);
                  }}
                  className="rounded-full bg-neon-cyan/10 border border-neon-cyan/20 px-3 py-1 text-xs text-neon-cyan hover:bg-neon-cyan/20 transition-colors truncate max-w-[160px]"
                  title={node.id}
                >
                  {basename(node.id)}
                </button>
              ))}

              {connectedNodes.length === 0 && (
                <p className="text-xs text-gray-600 italic">No connections</p>
              )}
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="h-px bg-white/10 mb-5" />

          {/* ── AI Summary ── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">
              ✨ File Summary
            </h3>

            {summaryLoading ? (
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-white/5 animate-pulse" />
                <div className="h-3 w-4/5 rounded bg-white/5 animate-pulse" />
                <div className="h-3 w-3/5 rounded bg-white/5 animate-pulse" />
              </div>
            ) : (
              <blockquote className="border-l-2 border-neon-cyan/30 pl-4 text-sm text-gray-300 leading-relaxed">
                {summary || 'Click a node to view its summary.'}
              </blockquote>
            )}
          </div>
        </>
      )}
    </div>
  );
}
