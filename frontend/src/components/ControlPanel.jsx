import {
  Layers, Maximize2, Minimize2, RotateCcw,
} from 'lucide-react';
import useStore, {
  selectActiveFilter,
} from '../store/useStore';

const FILTERS = [
  { key: 'all', label: 'Show All' },
  { key: 'frontend', label: 'Frontend' },
  { key: 'backend', label: 'Backend' },
];

const LEGEND = [
  { color: '#4A90E2', label: 'Frontend' },
  { color: '#FF6B6B', label: 'Backend' },
  { color: '#FFC857', label: 'Folders' },
  { color: '#2ECC71', label: 'Files' },
  { color: '#9B59B6', label: 'Config' },
];

/**
 * Floating control panel at bottom-left: group filters,
 * expand/collapse controls, reset, and a color legend.
 */
export default function ControlPanel() {
  const activeFilter = useStore(selectActiveFilter);
  const setActiveFilter = useStore((s) => s.setActiveFilter);
  const expandAll = useStore((s) => s.expandAll);
  const collapseAll = useStore((s) => s.collapseAll);
  const resetLayout = useStore((s) => s.resetLayout);

  return (
    <div className="fixed bottom-6 left-[300px] z-50 flex items-end gap-4">
      {/* ── Legend ── */}
      <div className="glass p-3 min-w-[200px]">
        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">
          Legend
        </p>
        <div className="grid grid-cols-2 gap-y-2 gap-x-2">
          {LEGEND.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}60` }}
              />
              <span className="text-[11px] text-gray-300">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filter pills (exact right of legends) ── */}
      <div className="glass p-3 flex flex-col gap-2 min-w-[240px]">
        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1 flex items-center gap-1">
          <Layers className="h-3 w-3" /> Filter
        </p>
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                activeFilter === f.key
                  ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 shadow-[0_0_8px_rgba(0,245,255,0.3)]'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Actions (Expand/Collapse/Reset) so it does not overlap ── */}
      <div className="glass p-3 flex flex-col gap-2">
        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">
          Graph Actions
        </p>
        <div className="flex gap-1.5 h-full items-end">
          <button
            onClick={expandAll}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 hover:text-white transition-colors h-[28px]"
            title="Expand all folders"
          >
            <Maximize2 className="h-3 w-3" /> Expand
          </button>
          <button
            onClick={collapseAll}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 hover:text-white transition-colors h-[28px]"
            title="Collapse all folders"
          >
            <Minimize2 className="h-3 w-3" /> Collapse
          </button>
          <button
            onClick={resetLayout}
            className="flex items-center justify-center gap-1 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 hover:text-white transition-colors h-[28px]"
            title="Reset graph layout"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
