import { useRef, useEffect, useState, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import useStore, {
  selectGraphData,
  selectCameraTarget,
  selectExpandedNodes,
} from '../store/useStore';

// ── Color palette ───────────────────────────────────────────────────────────
const COLORS = {
  frontend: '#4A90E2',
  backend:  '#FF6B6B',
  folder:   '#FFC857',
  config:   '#9B59B6',
  file:     '#2ECC71',
  linkImport: '#74B9FF',
  linkDefault: '#BDC3C7',
};

function getNodeColor(node) {
  if (node.type === 'folder') return COLORS.folder;
  if (node.group === 'frontend') return COLORS.frontend;
  if (node.group === 'backend') return COLORS.backend;
  if (node.group === 'config') return COLORS.config;
  return COLORS.file;
}

export default function Graph3D() {
  const graphRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  const graphData = useStore(selectGraphData);
  const cameraTarget = useStore(selectCameraTarget);
  const toggleExpand = useStore((s) => s.toggleExpand);
  const setSelectedNode = useStore((s) => s.setSelectedNode);
  const expandedNodes = useStore(selectExpandedNodes);

  // Handle Resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Handle Camera Fly-To
  useEffect(() => {
    if (cameraTarget && graphRef.current) {
      graphRef.current.cameraPosition(
        { x: cameraTarget.x, y: cameraTarget.y + 100, z: cameraTarget.z + 150 },
        cameraTarget,
        1000,
      );
    }
  }, [cameraTarget]);

  // Handle auto-fit on data change (debounced slightly to let physics settle)
  useEffect(() => {
    if (graphRef.current && graphData?.nodes?.length > 0) {
      const timer = setTimeout(() => {
        graphRef.current.zoomToFit(600, 50);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [graphData]);

  // Callbacks
  const handleNodeClick = useCallback(
    (node) => {
      if (node.type === 'folder') {
        toggleExpand(node.id);
      } else {
        setSelectedNode(node);
        useStore.getState().focusNode(node);
      }
    },
    [toggleExpand, setSelectedNode]
  );
  
  const nodeValFn = useCallback((node) => {
    if (node.type === 'folder') return 8;
    return Math.max(3, Math.min(node.size || 4, 10));
  }, []);

  const getNodeLabel = useCallback((node) => {
    if (node.type === 'folder') {
      const exp = expandedNodes.has(node.id);
      return `📁 ${node.label} (${node.childCount || 0})${exp ? '' : ' ▶ click to expand'}`;
    }
    return `${node.label}${node.lineCount ? ` • ${node.lineCount} lines` : ''} [${node.group}]`;
  }, [expandedNodes]);

  const getLinkColor = useCallback((link) => {
    return link.type === 'import' ? COLORS.linkImport : COLORS.linkDefault;
  }, []);

  const isLarge = (graphData?.nodes?.length || 0) > 300;

  return (
    <div ref={containerRef} className="w-full h-full" style={{ position: 'absolute', inset: 0 }}>
      <ForceGraph3D
        ref={graphRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        nodeColor={getNodeColor}
        nodeVal={nodeValFn}
        nodeRelSize={5}
        nodeLabel={getNodeLabel}
        linkColor={getLinkColor}
        linkOpacity={0.6}
        linkWidth={isLarge ? 0.5 : 1}
        onNodeClick={handleNodeClick}
        backgroundColor="#0a0e1a"
      />
    </div>
  );
}
