import { create } from 'zustand';

/**
 * Global application state store powered by Zustand.
 *
 * This single store manages all shared state for the RepoMap frontend:
 * graph visualisation data, UI flags, and camera controls.
 */
const useStore = create((set) => ({
  // ─── Graph Data ────────────────────────────────────────────────
  /** The force-graph payload — `{ nodes: [...], links: [...] }` returned by the API. */
  graphData: { nodes: [], links: [] },

  // ─── UI State ──────────────────────────────────────────────────
  /** The node object the user last clicked; `null` when no node is selected (sidebar closed). */
  selectedNode: null,

  /** Whether an async operation (repo download, analysis, etc.) is in progress. */
  isLoading: false,

  /** Human-readable progress text shown alongside the loading spinner, e.g. "Downloading repository…" */
  loadingMessage: '',

  /** Error descriptor `{ code, message }` or `null` when there is no error. */
  error: null,

  /** Current value of the search / filter input in the toolbar. */
  searchQuery: '',

  // ─── Camera Control ────────────────────────────────────────────
  /** Target `{ x, y, z }` the camera should fly to; consumed by the Graph component. */
  cameraTarget: null,

  // ─── Actions ───────────────────────────────────────────────────

  /**
   * Replace the graph payload after a successful API response.
   * Clears any previous loading / error state.
   * @param {{ nodes: Array, links: Array }} data
   */
  setGraphData: (data) =>
    set({ graphData: data, isLoading: false, loadingMessage: '', error: null }),

  /**
   * Set (or clear) the currently selected node.
   * Pass `null` to deselect and close the detail sidebar.
   * @param {object|null} node
   */
  setSelectedNode: (node) => set({ selectedNode: node }),

  /**
   * Toggle the global loading state with an optional progress message.
   * @param {boolean} bool  — whether loading is active
   * @param {string}  [message=''] — descriptive text for the spinner
   */
  setLoading: (bool, message = '') =>
    set({ isLoading: bool, loadingMessage: message }),

  /**
   * Record an error and stop any in-progress loading.
   * @param {number} code    — HTTP status or custom error code
   * @param {string} message — user-facing error description
   */
  setError: (code, message) =>
    set({ error: { code, message }, isLoading: false, loadingMessage: '' }),

  /**
   * Dismiss the current error.
   */
  clearError: () => set({ error: null }),

  /**
   * Update the toolbar search / filter query.
   * @param {string} query
   */
  setSearchQuery: (query) => set({ searchQuery: query }),

  /**
   * Fly the 3D camera to a specific node's position.
   * The Graph component watches `cameraTarget` and animates accordingly.
   * @param {object} node — must have `x`, `y`, `z` properties
   */
  focusNode: (node) =>
    set({ cameraTarget: { x: node.x, y: node.y, z: node.z } }),
}));

export default useStore;

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
