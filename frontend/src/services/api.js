import axios from 'axios';

/** Base URL pulled from env or falling back to local dev server. */
const BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Convert an Axios error response into a normalised `{ code, message }` object.
 * Handles network errors, timeouts, and all HTTP error codes.
 *
 * @param {Error} error — Axios error instance
 * @returns {{ code: number, message: string }}
 */
export function parseApiError(error) {
  if (error.response) {
    const { status, data } = error.response;
    const message =
      data?.message ||
      data?.error ||
      {
        400: 'Bad request — please check your input.',
        401: 'Unauthorized — authentication required.',
        403: 'Forbidden — you don\'t have access.',
        404: 'Resource not found.',
        422: 'Unprocessable entity — invalid data.',
        429: 'Rate limit exceeded — please try again later.',
        500: 'Internal server error — try again shortly.',
        502: 'Bad gateway — the server is temporarily unavailable.',
        503: 'Service unavailable — please try again later.',
      }[status] ||
      `Unexpected error (HTTP ${status})`;
    return { code: status, message };
  }

  if (error.code === 'ECONNABORTED') {
    return { code: 408, message: 'Request timed out — please try again.' };
  }

  return {
    code: 0,
    message: error.message || 'Network error — check your connection.',
  };
}

// ─── API Functions ─────────────────────────────────────────────

/**
 * Stream the repository analysis via Server-Sent Events.
 *
 * The backend pushes three event types:
 *  • `progress` — `{ message }` — forwarded to `onProgress`
 *  • `result`   — `{ nodes, links }` — resolves the promise
 *  • `error`    — `{ code, message }` — rejects the promise
 *
 * Falls back to a plain POST request when `EventSource` is unavailable.
 *
 * @param {string}   githubUrl  — full GitHub repository URL
 * @param {function} onProgress — called with each progress message string
 * @returns {Promise<{ nodes: Array, links: Array }>}
 */
export async function analyzeRepo(githubUrl, onProgress = () => {}) {
  // ── Fallback for environments without EventSource ──
  if (typeof EventSource === 'undefined') {
    const res = await axios.post(`${BASE_URL}/api/analyze`, {
      url: githubUrl,
    });
    return res.data;
  }

  // ── SSE stream ──
  return new Promise((resolve, reject) => {
    const encodedUrl = encodeURIComponent(githubUrl);
    const eventSource = new EventSource(
      `${BASE_URL}/api/analyze/stream?url=${encodedUrl}`,
    );

    /** Safely close the connection. */
    const close = () => {
      try {
        eventSource.close();
      } catch {
        /* already closed */
      }
    };

    eventSource.addEventListener('progress', (e) => {
      try {
        const { message } = JSON.parse(e.data);
        onProgress(message);
      } catch {
        /* malformed progress event — skip */
      }
    });

    eventSource.addEventListener('result', (e) => {
      close();
      try {
        const data = JSON.parse(e.data);
        resolve(data);
      } catch (err) {
        reject({ code: 500, message: 'Failed to parse analysis result.' });
      }
    });

    eventSource.addEventListener('error', (e) => {
      close();
      try {
        const data = JSON.parse(e.data);
        reject({ code: data.code || 500, message: data.message || 'Analysis failed.' });
      } catch {
        reject({ code: 500, message: 'An unknown error occurred during analysis.' });
      }
    });

    // Native EventSource error (connection lost, etc.)
    eventSource.onerror = () => {
      close();
      reject({ code: 0, message: 'Lost connection to the server.' });
    };
  });
}

/**
 * Fetch an AI-generated summary for a single file.
 *
 * @param {string} filePath — repo-relative file path (e.g. "src/utils/auth.js")
 * @returns {Promise<string>} — plain-text summary
 */
export async function getFileSummary(filePath) {
  try {
    const res = await axios.get(`${BASE_URL}/api/summary`, {
      params: { path: filePath },
    });
    return res.data.summary;
  } catch (error) {
    if (error.response) {
      const { status } = error.response;
      if (status === 404) throw new Error('File not found');
      if (status === 429) throw new Error('AI rate limit hit, try again later');
    }
    throw new Error(error.message || 'Failed to fetch file summary');
  }
}
