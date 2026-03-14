import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import useStore, {
  selectGraphData,
  selectCameraTarget,
} from '../store/useStore';

/**
 * Return a hex colour based on a file's extension.
 * @param {string} name — file name or path
 */
function colorForFile(name = '') {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) return 0x00f5ff; // cyan
  if (ext === '.py') return 0x39ff14; // green
  if (['.cpp', '.h', '.hpp'].includes(ext)) return 0xff6b00; // orange
  return 0xaaaaaa; // grey
}

/**
 * Build a glowing‑circle canvas texture for sprite‑based nodes.
 * Drawn once, then reused via THREE.CanvasTexture.
 */
function createGlowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2,
  );
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(0,245,255,0.8)');
  gradient.addColorStop(1, 'rgba(0,245,255,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
}

/**
 * Core 3D force‑directed graph visualisation.
 *
 * Uses `react-force-graph-3d` with:
 * - Level‑of‑detail rendering (sprites for small graphs, meshes for large)
 * - Smooth camera fly‑to via `cameraTarget` from Zustand
 * - Dynamic canvas sizing via ResizeObserver
 */
export default function Graph3D() {
  const graphRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // ── Zustand state ──
  const graphData = useStore(selectGraphData);
  const cameraTarget = useStore(selectCameraTarget);
  const setSelectedNode = useStore((s) => s.setSelectedNode);

  // ── LOD flag ──
  const isLargeGraph = graphData.nodes.length > 2000;

  // ── Glow texture (created once) ──
  const glowTexture = useMemo(() => createGlowTexture(), []);

  // ── Node rendering callback ──
  const nodeThreeObject = useCallback(
    (node) => {
      if (!isLargeGraph) {
        // Sprite‑based glowing orb
        const material = new THREE.SpriteMaterial({
          map: glowTexture,
          transparent: true,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(material);
        const s = node.size || 10;
        sprite.scale.set(s, s, 1);
        return sprite;
      }

      // Mesh‑based sphere (cheaper for large graphs)
      const radius = node.size || 3;
      const geometry = new THREE.SphereGeometry(radius, 6, 6);
      const material = new THREE.MeshBasicMaterial({
        color: colorForFile(node.label || node.id || ''),
      });
      return new THREE.Mesh(geometry, material);
    },
    [isLargeGraph, glowTexture],
  );

  // ── Camera fly‑to ──
  useEffect(() => {
    if (cameraTarget && graphRef.current) {
      graphRef.current.cameraPosition(
        {
          x: cameraTarget.x,
          y: cameraTarget.y + 100,
          z: cameraTarget.z + 200,
        },
        cameraTarget, // lookAt
        1500,         // transition ms
      );
    }
  }, [cameraTarget]);

  // ── Dynamic canvas resizing ──
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

  return (
    <div ref={containerRef} className="w-full h-full">
      <ForceGraph3D
        ref={graphRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        onNodeClick={(node) => setSelectedNode(node)}
        linkColor={() => 'rgba(0,245,255,0.2)'}
        linkWidth={0.5}
        backgroundColor="#0a0e1a"
        nodeLabel={(node) => node.label}
      />
    </div>
  );
}
