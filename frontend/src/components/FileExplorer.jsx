import { useState, useMemo, useEffect, useRef } from 'react';
import { Folder, FolderOpen, FileCode, ChevronRight, ChevronDown } from 'lucide-react';
import useStore, {
  selectRawGraphData,
  selectSelectedNode,
  selectExpandedNodes,
} from '../store/useStore';

const GROUP_COLORS = {
  frontend: { text: 'text-blue-400',       color: '#4A90E2' },
  backend:  { text: 'text-red-400',        color: '#FF6B6B' },
  config:   { text: 'text-purple-400',     color: '#9B59B6' },
  shared:   { text: 'text-green-400',      color: '#2ECC71' },
};

function basename(path = '') {
  return path.split('/').pop();
}

// Recursive Tree Node Component
function TreeNode({ node, tree, level, selectedNodeId, expandedNodes, onToggleExpand, onSelectNode }) {
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const children = tree.get(node.id) || [];
  const hasChildren = children.length > 0;
  
  const groupStyle = GROUP_COLORS[node.group] || GROUP_COLORS.shared;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-1 px-2 cursor-pointer rounded-md transition-colors ${
          isSelected ? 'bg-[#00f5ff]/15 border border-[#00f5ff]/30' : 'hover:bg-white/5 border border-transparent'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (node.type === 'folder') {
            onToggleExpand(node.id);
          } else {
            onSelectNode(node);
          }
        }}
      >
        {/* Expansion Icon for folders */}
        <div className="w-4 h-4 shrink-0 flex items-center justify-center">
          {node.type === 'folder' && (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 flex-none text-gray-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 flex-none text-gray-400" />
            )
          )}
        </div>

        {/* File/Folder Icon */}
        {node.type === 'folder' ? (
          isExpanded ? (
            <FolderOpen className="h-4 w-4 shrink-0" style={{ color: '#FFC857' }} />
          ) : (
            <Folder className="h-4 w-4 shrink-0" style={{ color: '#FFC857' }} />
          )
        ) : (
          <FileCode className="h-4 w-4 shrink-0" style={{ color: groupStyle.color }} />
        )}

        {/* Label */}
        <span className={`text-[12px] truncate ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>
          {basename(node.id)}
        </span>
      </div>

      {/* Render Children if expanded */}
      {node.type === 'folder' && isExpanded && hasChildren && (
        <div className="flex flex-col">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              tree={tree}
              level={level + 1}
              selectedNodeId={selectedNodeId}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileExplorer() {
  const rawData = useStore(selectRawGraphData);
  const selectedNode = useStore(selectSelectedNode);
  const expandedNodes = useStore(selectExpandedNodes);
  const toggleExpand = useStore((s) => s.toggleExpand);
  const setSelectedNode = useStore((s) => s.setSelectedNode);
  const focusNode = useStore((s) => s.focusNode);

  // Build a fast lookup tree: parentId -> children[]
  const { rootNodes, tree } = useMemo(() => {
    const parentMap = new Map();
    const roots = [];

    const nodes = rawData?.nodes || [];
    
    // Sort nodes: folders first, then alphabetical
    const sortedNodes = [...nodes].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.label.localeCompare(b.label);
    });

    for (const n of sortedNodes) {
      if (!n.parent || n.parent === '__root__') {
        // Find actual root-level items (usually one main root, but just in case)
        if (n.id === '__root__') {
          roots.push(n);
        } else if (!nodes.some(rootCand => rootCand.id === n.parent)) {
          roots.push(n);
        } else {
          if (!parentMap.has(n.parent)) parentMap.set(n.parent, []);
          parentMap.get(n.parent).push(n);
        }
      } else {
        if (!parentMap.has(n.parent)) parentMap.set(n.parent, []);
        parentMap.get(n.parent).push(n);
      }
    }

    return { rootNodes: roots.length > 0 ? roots : sortedNodes.filter(n => !n.parent || n.parent === '__root__'), tree: parentMap };
  }, [rawData]);

  const handleSelectNode = (node) => {
    setSelectedNode(node);
    if (node.x != null) {
      focusNode(node);
    }
  };

  // If there's no data yet, don't show the explorer
  if (!rawData?.nodes?.length) return null;

  return (
    <div className="fixed left-0 top-0 h-screen w-72 bg-dark-base/95 backdrop-blur-xl border-r border-white/10 z-40 flex flex-col shadow-2xl">
      <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-bold text-gray-200 uppercase tracking-widest pl-2 border-l-2 border-[#00f5ff]">
          File Explorer
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {rootNodes.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            tree={tree}
            level={0}
            selectedNodeId={selectedNode?.id}
            expandedNodes={expandedNodes}
            onToggleExpand={toggleExpand}
            onSelectNode={handleSelectNode}
          />
        ))}
      </div>
    </div>
  );
}
