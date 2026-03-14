import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import useStore, {
  selectGraphData,
  selectCameraTarget,
  selectSearchHighlight,
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

function nodeColor(node) {
  if (node.type === 'folder') return COLORS.folder;
  if (node.group === 'frontend') return COLORS.frontend;
  if (node.group === 'backend') return COLORS.backend;
  if (node.group === 'config') return COLORS.config;
  return COLORS.file;
}

// ── Shared geometry/materials (created once, reused everywhere) ─────────
const sphereGeo = new THREE.SphereGeometry(1, 8, 8);
const icoGeo = new THREE.IcosahedronGeometry(1, 0);

// Material cache to avoid creating one per node
const matCache = new Map();
function getCachedMaterial(hexColor, wireframe = false, opacity = 1) {
  const key = `${hexColor}-${wireframe}-${opacity}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshBasicMaterial({
      color: hexColor,
      wireframe,
      transparent: opacity < 1,
      opacity,
    }));
  }
  return matCache.get(key);
}

// ── Component ───────────────────────────────────────────────────────────────
export default function Graph3D() {
  const graphRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const graphData = useStore(selectGraphData);
  const cameraTarget = useStore(selectCameraTarget);
  const selectedNode = useStore((s) => s.selectedNode);
  const setSelectedNode = useStore((s) => s.setSelectedNode);
  const toggleExpand = useStore((s) => s.toggleExpand);
  const expandedNodes = useStore(selectExpandedNodes);
  const searchHighlight = useStore(selectSearchHighlight);

  const nodeCount = graphData?.nodes?.length || 0;
  const isLarge = nodeCount > 500;

  // Memoize graph data reference to avoid unnecessary re-renders
  const stableGraphData = useMemo(() => {
    if (!graphData?.nodes?.length) return { nodes: [], links: [] };
    return graphData;
  }, [graphData]);

  // Node rendering — use simple meshes, reuse geometry + materials
  const nodeThreeObject = useCallback(
    (node) => {
      const color = nodeColor(node);

      if (node.type === 'folder') {
        const isExp = expandedNodes.has(node.id);
        const s = Math.min((node.childCount || 3) > 10 ? 8 : 5, 8);
        const mat = getCachedMaterial(color, true, isExp ? 0.4 : 0.85);
        const mesh = new THREE.Mesh(icoGeo, mat);
        mesh.scale.set(s, s, s);
        return mesh;
      }

      // File node — simple sphere
      const s = Math.max(2, Math.min(node.size || 5, 15));
      const mat = getCachedMaterial(color, false, 0.9);
      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.scale.set(s, s, s);
      return mesh;
    },
    [expandedNodes],
  );

  // Node click
  const handleNodeClick = useCallback(
    (node) => {
      if (node.type === 'folder') {
        toggleExpand(node.id);
      } else {
        setSelectedNode(node);
        useStore.getState().focusNode(node);
      }
    },
    [toggleExpand, setSelectedNode],
  );

  // Camera fly-to
  useEffect(() => {
    if (cameraTarget && graphRef.current) {
      graphRef.current.cameraPosition(
        { x: cameraTarget.x, y: cameraTarget.y + 80, z: cameraTarget.z + 150 },
        cameraTarget,
        1200,
      );
    }
  }, [cameraTarget]);

  // D3 forces
  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.d3Force('charge')?.strength(isLarge ? -80 : -150);
      graphRef.current.d3Force('link')?.distance(isLarge ? 30 : 50);
    }
  }, [stableGraphData, isLarge]);

  // Resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width && height) setDimensions({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Link color function
  const getLinkColor = useCallback((link) => {
    return link.type === 'import' ? COLORS.linkImport : COLORS.linkDefault;
  }, []);

  // Node label function
  const getNodeLabel = useCallback((node) => {
    if (node.type === 'folder') {
      const exp = expandedNodes.has(node.id);
      return `📁 ${node.label} (${node.childCount || 0})${exp ? '' : ' ▶ click to expand'}`;
    }
    return `${node.label}${node.lineCount ? ` • ${node.lineCount} lines` : ''} [${node.group}]`;
  }, [expandedNodes]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <ForceGraph3D
        ref={graphRef}
        graphData={stableGraphData}
        width={dimensions.width}
        height={dimensions.height}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        onNodeClick={handleNodeClick}
        nodeLabel={getNodeLabel}
        linkColor={getLinkColor}
        linkOpacity={0.5}
        linkWidth={isLarge ? 1 : 2}
        linkDirectionalParticles={isLarge ? 0 : 2}
        linkDirectionalParticleSpeed={0.003}
        linkDirectionalParticleWidth={1.5}
        backgroundColor="#0a0e1a"
        cooldownTicks={isLarge ? 50 : 100}
        warmupTicks={isLarge ? 20 : 50}
        d3AlphaDecay={isLarge ? 0.05 : 0.02}
        d3VelocityDecay={0.3}
        enableNodeDrag={!isLarge}
        nodeRelSize={1}
      />
    </div>
  );
}
