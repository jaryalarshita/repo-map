import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import useStore, {
  selectGraphData,
  selectCameraTarget,
  selectExpandedNodes,
  selectSelectedNode,
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
  dimmedNode: '#1a2436',
  dimmedLink: 'rgba(26, 36, 54, 0.2)',
};

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
  const selectedNode = useStore(selectSelectedNode);
  const setSelectedNode = useStore((s) => s.setSelectedNode);
  const expandedNodes = useStore(selectExpandedNodes);

  // Calculate connected nodes & links for highlighting
  const { connectedNodeIds, connectedLinks } = useMemo(() => {
    const nIds = new Set();
    const lSet = new Set();
    if (!selectedNode || selectedNode.type === 'folder' || !graphData?.links) {
      return { connectedNodeIds: nIds, connectedLinks: lSet };
    }

    nIds.add(selectedNode.id);
    
    graphData.links.forEach((link) => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      if (sourceId === selectedNode.id) {
        nIds.add(targetId);
        lSet.add(link);
      } else if (targetId === selectedNode.id) {
        nIds.add(sourceId);
        lSet.add(link);
      }
    });
    return { connectedNodeIds: nIds, connectedLinks: lSet };
  }, [selectedNode, graphData]);

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

  const getNodeColor = useCallback((node) => {
    let baseColor;
    if (node.type === 'folder') baseColor = COLORS.folder;
    else if (node.group === 'frontend') baseColor = COLORS.frontend;
    else if (node.group === 'backend') baseColor = COLORS.backend;
    else if (node.group === 'config') baseColor = COLORS.config;
    else baseColor = COLORS.file;

    // Dim non-connected nodes if a file is selected
    if (selectedNode && selectedNode.type === 'file') {
      if (!connectedNodeIds.has(node.id)) {
        return COLORS.dimmedNode;
      }
    }
    return baseColor;
  }, [selectedNode, connectedNodeIds]);

  const getLinkColor = useCallback((link) => {
    const baseColor = link.type === 'import' ? COLORS.linkImport : COLORS.linkDefault;
    if (selectedNode && selectedNode.type === 'file') {
      if (!connectedLinks.has(link)) {
        return COLORS.dimmedLink;
      }
      return '#00f5ff'; // Bright cyan for highlighted connections
    }
    return baseColor;
  }, [selectedNode, connectedLinks]);

  const isLarge = (graphData?.nodes?.length || 0) > 300;

  const getLinkWidth = useCallback((link) => {
    const baseWidth = isLarge ? 0.3 : 1;
    if (selectedNode && selectedNode.type === 'file' && connectedLinks.has(link)) {
      return baseWidth * 3;
    }
    return baseWidth;
  }, [isLarge, selectedNode, connectedLinks]);

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
        linkOpacity={selectedNode?.type === 'file' ? 0.9 : 0.6}
        linkWidth={getLinkWidth}
        onNodeClick={handleNodeClick}
        backgroundColor="#0a0e1a"
      />
    </div>
  );
}
