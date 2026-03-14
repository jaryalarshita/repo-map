import { create } from 'zustand';

// ── Visible-graph builder ──────────────────────────────────────────────────
// Given the full hierarchical data, the set of expanded folder IDs, and the
// active group filter, compute the subset of nodes and links to render.

function buildVisibleGraph(raw, expandedNodes, activeFilter) {
  if (!raw?.nodes?.length) return { nodes: [], links: [] };

  // Build children lookup for fast traversal
  const childrenOf = new Map();
  for (const n of raw.nodes) {
    if (n.parent != null) {
      if (!childrenOf.has(n.parent)) childrenOf.set(n.parent, []);
      childrenOf.get(n.parent).push(n);
    }
  }

  // For filtering: collect all file node IDs that match the filter
  const matchingFileIds = new Set();
  if (activeFilter !== 'all') {
    for (const n of raw.nodes) {
      if (n.type === 'file' && n.group === activeFilter) {
        matchingFileIds.add(n.id);
      }
    }
  }

  // Determine which nodes are visible via expansion state
  const visible = new Set();
  visible.add('__root__');

  function addChildrenOf(parentId) {
    const children = childrenOf.get(parentId) || [];
    for (const n of children) {
      // Apply group filter — for folders, check if ANY descendant file matches
      if (activeFilter !== 'all') {
        if (n.type === 'file' && n.group !== activeFilter) continue;
        if (n.type === 'folder' && !hasMachingDescendant(n.id)) continue;
      }

      visible.add(n.id);

      if (n.type === 'folder' && expandedNodes.has(n.id)) {
        addChildrenOf(n.id);
      }
    }
  }

  // Check if a folder has any descendant file matching the filter
  function hasMachingDescendant(folderId) {
    if (activeFilter === 'all') return true;
    const children = childrenOf.get(folderId) || [];
    for (const c of children) {
      if (c.type === 'file' && c.group === activeFilter) return true;
      if (c.type === 'folder' && hasMachingDescendant(c.id)) return true;
    }
    return false;
  }

  addChildrenOf('__root__');

  const visibleNodes = raw.nodes.filter(n => visible.has(n.id));

  // Only include links where both source and target are visible
  const visibleLinks = raw.links.filter(l => {
    const sid = typeof l.source === 'object' ? l.source.id : l.source;
    const tid = typeof l.target === 'object' ? l.target.id : l.target;
    return visible.has(sid) && visible.has(tid);
  });

  return { nodes: visibleNodes, links: visibleLinks };
}

// ── Compute initial expanded set ────────────────────────────────────────────
function computeInitialExpanded(nodes) {
  const expanded = new Set();
  expanded.add('__root__');
  for (const n of nodes) {
    if (n.type === 'folder' && n.parent === '__root__') {
      expanded.add(n.id);
    }
  }
  return expanded;
}

// ── Store ───────────────────────────────────────────────────────────────────
const useStore = create((set, get) => ({
  rawGraphData: { nodes: [], links: [] },
  graphData: { nodes: [], links: [] },

<<<<<<< HEAD
=======
  /** The GitHub URL of the currently analyzed repository. */
  githubUrl: '',

  // ─── UI State ──────────────────────────────────────────────────
  /** The node object the user last clicked; `null` when no node is selected (sidebar closed). */
>>>>>>> ce38c7999bf903e4266ddd529e44dcfb7313437f
  selectedNode: null,
  isLoading: false,
  loadingMessage: '',
  error: null,
  searchQuery: '',

  activeFilter: 'all',
  expandedNodes: new Set(),
  searchHighlight: '',

  // File content viewer
  fileContent: null,
  fileContentLoading: false,

  cameraTarget: null,

  // ─── Actions ───────────────────────────────────────────────────

  setGraphData: (data) => {
    const expanded = computeInitialExpanded(data.nodes || []);
    const visible = buildVisibleGraph(data, expanded, 'all');
    set({
      rawGraphData: data,
      graphData: visible,
      expandedNodes: expanded,
      activeFilter: 'all',
      searchHighlight: '',
      fileContent: null,
      isLoading: false,
      loadingMessage: '',
      error: null,
    });
  },

<<<<<<< HEAD
  setSelectedNode: (node) => set({ selectedNode: node, fileContent: null, fileContentLoading: false }),
=======
  /**
   * Set the GitHub URL of the currently analyzed repository.
   * @param {string} url
   */
  setGithubUrl: (url) => set({ githubUrl: url }),

  /**
   * Set (or clear) the currently selected node.
   * Pass `null` to deselect and close the detail sidebar.
   * @param {object|null} node
   */
  setSelectedNode: (node) => set({ selectedNode: node }),
>>>>>>> ce38c7999bf903e4266ddd529e44dcfb7313437f

  setLoading: (bool, message = '') =>
    set({ isLoading: bool, loadingMessage: message }),

  setError: (code, message) =>
    set({ error: { code, message }, isLoading: false, loadingMessage: '' }),

  clearError: () => set({ error: null }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  focusNode: (node) =>
    set({ cameraTarget: { x: node.x, y: node.y, z: node.z } }),

  // File content
  setFileContent: (content) => set({ fileContent: content, fileContentLoading: false }),
  setFileContentLoading: (v) => set({ fileContentLoading: v }),

  // ─── Hierarchy actions ─────────────────────────────────────────

  setActiveFilter: (filter) => {
    const { rawGraphData, expandedNodes } = get();
    const visible = buildVisibleGraph(rawGraphData, expandedNodes, filter);
    set({ activeFilter: filter, graphData: visible });
  },

  toggleExpand: (nodeId) => {
    const { rawGraphData, expandedNodes, activeFilter } = get();
    const next = new Set(expandedNodes);
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    const visible = buildVisibleGraph(rawGraphData, next, activeFilter);
    set({ expandedNodes: next, graphData: visible });
  },

  expandAll: () => {
    const { rawGraphData, activeFilter } = get();
    const allFolders = new Set();
    for (const n of rawGraphData.nodes) {
      if (n.type === 'folder') allFolders.add(n.id);
    }
    const visible = buildVisibleGraph(rawGraphData, allFolders, activeFilter);
    set({ expandedNodes: allFolders, graphData: visible });
  },

  collapseAll: () => {
    const { rawGraphData, activeFilter } = get();
    const rootOnly = new Set(['__root__']);
    const visible = buildVisibleGraph(rawGraphData, rootOnly, activeFilter);
    set({ expandedNodes: rootOnly, graphData: visible });
  },

  setSearchHighlight: (term) => set({ searchHighlight: term }),

  resetLayout: () => {
    const { rawGraphData } = get();
    const expanded = computeInitialExpanded(rawGraphData.nodes || []);
    const visible = buildVisibleGraph(rawGraphData, expanded, 'all');
    set({
      expandedNodes: expanded,
      activeFilter: 'all',
      searchHighlight: '',
      graphData: visible,
      fileContent: null,
    });
  },
}));

export default useStore;

<<<<<<< HEAD
export const selectGraphData = (s) => s.graphData;
export const selectRawGraphData = (s) => s.rawGraphData;
export const selectSelectedNode = (s) => s.selectedNode;
export const selectIsLoading = (s) => s.isLoading;
export const selectError = (s) => s.error;
export const selectCameraTarget = (s) => s.cameraTarget;
export const selectActiveFilter = (s) => s.activeFilter;
export const selectExpandedNodes = (s) => s.expandedNodes;
export const selectSearchHighlight = (s) => s.searchHighlight;
=======
// ─── Selector Functions ────────────────────────────────────────
// Use these with `useStore(selectXxx)` for minimal re-renders.

/** @returns {{ nodes: Array, links: Array }} */
export const selectGraphData = (state) => state.graphData;

/** @returns {object|null} */
export const selectSelectedNode = (state) => state.selectedNode;

/** @returns {boolean} */
export const selectIsLoading = (state) => state.isLoading;

/** @returns {{ code: number, message: string }|null} */
export const selectError = (state) => state.error;

/** @returns {{ x: number, y: number, z: number }|null} */
export const selectCameraTarget = (state) => state.cameraTarget;

/** @returns {string} */
export const selectGithubUrl = (state) => state.githubUrl;
>>>>>>> ce38c7999bf903e4266ddd529e44dcfb7313437f
