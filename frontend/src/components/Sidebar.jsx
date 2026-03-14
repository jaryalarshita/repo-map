import { useState, useEffect } from 'react';
import { X, FileCode, Folder, ArrowUpRight, ArrowDownLeft, Code2, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import useStore, { selectGraphData, selectSelectedNode, selectGithubUrl } from '../store/useStore';
import { getFileSummary, getFileContent } from '../services/api';

const GROUP_COLORS = {
  frontend: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', color: '#4A90E2' },
  backend:  { bg: 'bg-red-400/15',  text: 'text-red-400',  border: 'border-red-400/30',  color: '#FF6B6B' },
  config:   { bg: 'bg-purple-400/15', text: 'text-purple-400', border: 'border-purple-400/30', color: '#9B59B6' },
  shared:   { bg: 'bg-green-400/15', text: 'text-green-400', border: 'border-green-400/30', color: '#2ECC71' },
};

export default function Sidebar() {
  const selectedNode = useStore(selectSelectedNode);
  const graphData = useStore(selectGraphData);
  const githubUrl = useStore(selectGithubUrl);
  const setSelectedNode = useStore((s) => s.setSelectedNode);
  const focusNode = useStore((s) => s.focusNode);
  const toggleExpand = useStore((s) => s.toggleExpand);

  // Tabs: 'info' | 'code'
  const [activeTab, setActiveTab] = useState('info');

  // AI summary
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // File content
  const [fileContent, setFileContent] = useState(null);
  const [fileContentLoading, setFileContentLoading] = useState(false);

  // Collapsible sections
  const [showConnections, setShowConnections] = useState(true);

  // Reset on node change
  useEffect(() => {
    setSummary(null);
    setSummaryLoading(false);
    setFileContent(null);
    setFileContentLoading(false);
    setActiveTab('info');
  }, [selectedNode?.id]);

  // Fetch AI summary for file nodes
  useEffect(() => {
    if (!selectedNode?.id || selectedNode?.type === 'folder') return;
    let cancelled = false;
    setSummaryLoading(true);

    // Pass githubUrl if available for remote fetching fallback
    getFileSummary(selectedNode.id, githubUrl)
      .then((text) => { if (!cancelled) { setSummary(text); setSummaryLoading(false); } })
      .catch(() => { if (!cancelled) { setSummary('Summary unavailable'); setSummaryLoading(false); } });

    return () => { cancelled = true; };
  }, [selectedNode?.id, selectedNode?.type, githubUrl]);

  // Fetch file content when code tab selected
  useEffect(() => {
    if (activeTab !== 'code' || !selectedNode?.id || selectedNode?.type === 'folder' || fileContent) return;
    let cancelled = false;
    setFileContentLoading(true);
    getFileContent(selectedNode.id)
      .then((data) => { if (!cancelled) { setFileContent(data); setFileContentLoading(false); } })
      .catch(() => { if (!cancelled) { setFileContent({ content: 'Unable to load file content', lineCount: 0, language: 'text' }); setFileContentLoading(false); } });
    return () => { cancelled = true; };
  }, [activeTab, selectedNode?.id, selectedNode?.type, fileContent]);

  // Connection helpers
  const imports = graphData.links.filter(
    (l) => (typeof l.source === 'object' ? l.source.id : l.source) === selectedNode?.id,
  );
  const importedBy = graphData.links.filter(
    (l) => (typeof l.target === 'object' ? l.target.id : l.target) === selectedNode?.id,
  );

  const basename = (p = '') => p.split('/').pop();

  const connectedIds = new Set();
  imports.forEach((l) => connectedIds.add(typeof l.target === 'object' ? l.target.id : l.target));
  importedBy.forEach((l) => connectedIds.add(typeof l.source === 'object' ? l.source.id : l.source));
  const connectedNodes = [...connectedIds]
    .map((id) => graphData.nodes.find((n) => n.id === id))
    .filter(Boolean);

  const groupStyle = GROUP_COLORS[selectedNode?.group] || GROUP_COLORS.shared;

  const folderChildren = selectedNode?.type === 'folder'
    ? graphData.nodes.filter((n) => n.parent === selectedNode?.id)
    : [];

  return (
    <div
      className="fixed right-0 top-0 h-screen w-[420px] z-50 flex flex-col overflow-hidden"
      style={{
        transform: selectedNode ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        background: 'rgba(10, 14, 26, 0.95)',
        backdropFilter: 'blur(16px)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {selectedNode && (
        <>
          {/* ── Header ── */}
          <div className="p-5 pb-3 shrink-0">
            <button
              onClick={() => setSelectedNode(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5 pr-8">
              {selectedNode.type === 'folder'
                ? <Folder className="h-5 w-5 shrink-0" style={{ color: '#FFC857' }} />
                : <FileCode className="h-5 w-5 shrink-0" style={{ color: groupStyle.color }} />
              }
              <h2 className="text-lg font-bold text-white truncate">
                {basename(selectedNode.id)}
              </h2>
            </div>
            <p className="text-[11px] text-gray-500 mt-1 break-all leading-relaxed">
              {selectedNode.id}
            </p>

            {/* Badges */}
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${groupStyle.bg} ${groupStyle.text} ${groupStyle.border}`}>
                {selectedNode.group}
              </span>
              {selectedNode.lineCount && (
                <span className="text-[10px] text-gray-500">
                  {selectedNode.lineCount} lines
                </span>
              )}
              {selectedNode.childCount != null && selectedNode.type === 'folder' && (
                <span className="text-[10px] text-gray-500">
                  {selectedNode.childCount} items
                </span>
              )}
            </div>

            {/* Tab bar for files */}
            {selectedNode.type === 'file' && (
              <div className="flex gap-1 mt-4 border-b border-white/10">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === 'info'
                      ? 'text-white border-[#00f5ff]'
                      : 'text-gray-500 border-transparent hover:text-gray-300'
                  }`}
                >
                  <Sparkles className="h-3 w-3" /> Info
                </button>
                <button
                  onClick={() => setActiveTab('code')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === 'code'
                      ? 'text-white border-[#00f5ff]'
                      : 'text-gray-500 border-transparent hover:text-gray-300'
                  }`}
                >
                  <Code2 className="h-3 w-3" /> Source
                </button>
              </div>
            )}
          </div>

          {/* ── Content area ── */}
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            {/* Folder contents */}
            {selectedNode.type === 'folder' && (
              <div className="mt-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Contents
                </h3>
                {folderChildren.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {folderChildren.slice(0, 30).map((child) => (
                      <button
                        key={child.id}
                        onClick={() => {
                          if (child.type === 'folder') toggleExpand(child.id);
                          else {
                            setSelectedNode(child);
                            if (child.x != null) focusNode(child);
                          }
                        }}
                        className="flex items-center gap-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] px-3 py-2 text-left transition-colors group"
                      >
                        {child.type === 'folder'
                          ? <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: '#FFC857' }} />
                          : <FileCode className="h-3.5 w-3.5 shrink-0" style={{ color: (GROUP_COLORS[child.group] || GROUP_COLORS.shared).color }} />
                        }
                        <span className="text-xs text-gray-300 group-hover:text-white truncate">
                          {basename(child.id)}
                        </span>
                        {child.lineCount && (
                          <span className="ml-auto text-[10px] text-gray-600">{child.lineCount}L</span>
                        )}
                      </button>
                    ))}
                    {folderChildren.length > 30 && (
                      <span className="text-[10px] text-gray-600 px-3">+{folderChildren.length - 30} more</span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 italic">Click the folder in the graph to expand</p>
                )}
              </div>
            )}

            {/* File — Info tab */}
            {selectedNode.type === 'file' && activeTab === 'info' && (
              <>
                {/* AI Summary */}
                <div className="mt-3">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    ✨ AI Summary
                  </h3>
                  {summaryLoading ? (
                    <div className="space-y-2">
                      <div className="h-3 w-full rounded bg-white/5 animate-pulse" />
                      <div className="h-3 w-4/5 rounded bg-white/5 animate-pulse" />
                      <div className="h-3 w-3/5 rounded bg-white/5 animate-pulse" />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {summary || 'Loading…'}
                    </p>
                  )}
                </div>

                {/* Connections */}
                <div className="mt-5">
                  <button
                    onClick={() => setShowConnections(!showConnections)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 hover:text-gray-200 transition-colors"
                  >
                    {showConnections ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    Connections ({imports.length + importedBy.length})
                  </button>

                  {showConnections && (
                    <>
                      <p className="text-xs text-gray-500 mb-2">
                        <span className="inline-flex items-center gap-0.5">
                          <ArrowUpRight className="h-3 w-3 text-blue-400" />
                          <span className="text-blue-400">{imports.length}</span>
                        </span>{' '}
                        imports{' '}
                        <span className="inline-flex items-center gap-0.5 ml-2">
                          <ArrowDownLeft className="h-3 w-3 text-orange-400" />
                          <span className="text-orange-400">{importedBy.length}</span>
                        </span>{' '}
                        imported by
                      </p>

                      <div className="flex flex-wrap gap-1.5">
                        {connectedNodes.map((node) => (
                          <button
                            key={node.id}
                            onClick={() => { setSelectedNode(node); if (node.x != null) focusNode(node); }}
                            className="rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[11px] text-gray-300 hover:bg-white/10 hover:text-white transition-colors truncate max-w-[160px]"
                            title={node.id}
                          >
                            {basename(node.id)}
                          </button>
                        ))}
                        {connectedNodes.length === 0 && (
                          <p className="text-[11px] text-gray-600 italic">No connections</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {/* File — Code tab */}
            {selectedNode.type === 'file' && activeTab === 'code' && (
              <div className="mt-3">
                {fileContentLoading ? (
                  <div className="space-y-1.5">
                    {[...Array(15)].map((_, i) => (
                      <div key={i} className="h-3 rounded bg-white/5 animate-pulse" style={{ width: `${40 + Math.random() * 60}%` }} />
                    ))}
                  </div>
                ) : fileContent ? (
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                        {fileContent.language} • {fileContent.lineCount} lines
                      </span>
                    </div>
                    <pre
                      className="text-[12px] leading-[1.65] overflow-x-auto rounded-lg p-4 font-mono whitespace-pre"
                      style={{
                        background: 'rgba(0,0,0,0.4)',
                        color: '#c9d1d9',
                        border: '1px solid rgba(255,255,255,0.06)',
                        maxHeight: 'calc(100vh - 280px)',
                        tabSize: 2
                      }}
                    >
                      {fileContent.content.split('\n').map((line, i) => (
                        <div key={i} className="flex">
                          <span className="select-none text-gray-600 text-right mr-4 shrink-0" style={{ minWidth: '2.5rem' }}>
                            {i + 1}
                          </span>
                          <span className="flex-1">{line || ' '}</span>
                        </div>
                      ))}
                    </pre>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">No content available</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
