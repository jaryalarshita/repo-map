# RepoMap

RepoMap turns a public GitHub repository into an interactive 3D dependency map. Enter a repository URL, wait for the analysis stream to finish, and explore the resulting codebase as a graph of folders, files, and imports.

The app provides:

- A streamed repository-analysis loading view.
- A 3D force-directed graph of the repository hierarchy and relationships.
- A file explorer for expanding folders and selecting files.
- Search across all analyzed files, with camera focus on visible results.
- Frontend, backend, and configuration group colors and filters.
- File metadata, AI-generated summaries, connections, and source previews in the sidebar.

## Repository layout

```text
.
├── frontend/       # React + Vite client application
└── backend/        # Reserved for the API service
```

The current checkout contains the frontend application. The backend is expected to expose the analysis, summary, and file-content endpoints described below.

## Requirements

- Node.js 18 or newer
- npm
- A running RepoMap backend, or access to the configured deployed backend

## Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

Available commands from `frontend/`:

```bash
npm run dev       # Start the Vite development server
npm run build     # Create a production build
npm run preview   # Preview the production build locally
npm run lint      # Run ESLint
```

## Configuration

`frontend/.env` contains the API base URL:

```dotenv
VITE_API_URL=http://localhost:3001
```

Do not commit `.env` or credentials. `.env.example` is the safe template for local setup.

## Backend API contract

The frontend expects these endpoints at the configured API base URL:

- `GET /api/analyze/stream?url=<github-repository-url>`: Server-Sent Events with `progress`, `result`, and `error` events.
- `POST /api/analyze`: Non-SSE fallback accepting `{ "url": "..." }`.
- `GET /api/summary?path=<file-path>&url=<github-repository-url>`: Returns `{ "summary": "..." }`.
- `GET /api/file-content?path=<file-path>`: Returns file content, line count, and language for the active repository.

Analysis results use this shape:

```json
{
  "nodes": [],
  "links": []
}
```

Each node should include an `id`, `type`, `parent`, and display metadata such as `label` or `group`. Links should identify `source`, `target`, and optionally `type`.

## Deployment

Build the frontend from its directory:

```bash
cd frontend
npm run build
```

Configure the hosting provider's project root or base directory as `frontend/`, and set `VITE_API_URL` to the deployed backend URL. The backend must allow requests from the deployed frontend origin, including SSE connections.
