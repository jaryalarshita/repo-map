// =============================================================================
// services/parserService.js — Hierarchical Dependency Parser (Pure Node.js)
// =============================================================================
// Walks a repository directory tree and produces a hierarchical graph of:
//   - Folder nodes  (type: "folder") with parent references and child counts
//   - File nodes    (type: "file")   with line counts, sizes, and group labels
//   - Import links  between files with type metadata
//
// Group classification is based on path heuristics:
//   frontend — components, pages, views, styles, public, src (non-backend)
//   backend  — routes, controllers, models, services, middleware, server, api
//   config   — config files, .env, package.json, etc.
//   shared   — everything else
// =============================================================================

const fs = require('fs');
const path = require('path');

// ── Supported file extensions ───────────────────────────────────────────────
const SUPPORTED_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx',
  '.cpp', '.cc', '.h', '.hpp',
  '.py',
]);

// ── Group classification heuristics ─────────────────────────────────────────

const FRONTEND_PATTERNS = [
  'components', 'pages', 'views', 'styles', 'public',
  'frontend', 'client', 'ui', 'layouts', 'hooks', 'context',
  'assets', 'static',
];

const BACKEND_PATTERNS = [
  'routes', 'controllers', 'models', 'services', 'middleware',
  'server', 'backend', 'api', 'handlers', 'resolvers', 'db',
  'database', 'migrations', 'seeds', 'prisma',
];

const CONFIG_EXTENSIONS = new Set([
  '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.env',
]);

const CONFIG_FILENAMES = new Set([
  'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.js',
  'vite.config.ts', 'next.config.js', 'next.config.mjs', 'webpack.config.js',
  '.eslintrc', '.eslintrc.js', '.eslintrc.json', 'eslint.config.js',
  '.prettierrc', '.babelrc', 'babel.config.js', 'jest.config.js',
  'tailwind.config.js', 'tailwind.config.ts', 'postcss.config.js',
  '.gitignore', '.env', '.env.example', '.env.local',
  'Makefile', 'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
  'README.md', 'LICENSE', 'CHANGELOG.md',
]);

function classifyGroup(relPath) {
  const lower = relPath.toLowerCase();
  const parts = lower.split('/');
  const filename = parts[parts.length - 1];

  // Config files first (most specific)
  if (CONFIG_FILENAMES.has(filename)) return 'config';
  const ext = path.extname(filename);
  if (CONFIG_EXTENSIONS.has(ext) && !SUPPORTED_EXTENSIONS.has(ext)) return 'config';
  if (filename.includes('.config.') || filename.includes('.rc')) return 'config';

  // Check path segments for frontend/backend patterns
  for (const part of parts) {
    if (FRONTEND_PATTERNS.includes(part)) return 'frontend';
    if (BACKEND_PATTERNS.includes(part)) return 'backend';
  }

  // Heuristic: if "src" is the top folder and nothing matched, default to frontend
  if (parts[0] === 'src') return 'frontend';

  return 'shared';
}

// ── Dependency parsers ──────────────────────────────────────────────────────

function extractBetweenQuotes(line, startPos) {
  const dq = line.indexOf('"', startPos);
  const sq = line.indexOf("'", startPos);
  let q1 = -1;
  let quoteChar = '"';

  if (dq !== -1 && (sq === -1 || dq < sq)) {
    q1 = dq; quoteChar = '"';
  } else if (sq !== -1) {
    q1 = sq; quoteChar = "'";
  }
  if (q1 === -1) return '';
  const q2 = line.indexOf(quoteChar, q1 + 1);
  if (q2 === -1) return '';
  return line.slice(q1 + 1, q2);
}

function parseJSDeps(content) {
  const deps = [];
  for (const line of content.split('\n')) {
    const importPos = line.indexOf('import');
    if (importPos !== -1) {
      const fromPos = line.indexOf('from', importPos);
      if (fromPos !== -1) {
        const dep = extractBetweenQuotes(line, fromPos);
        if (dep) { deps.push(dep); continue; }
      }
    }
    const reqPos = line.indexOf('require(');
    if (reqPos !== -1) {
      const dep = extractBetweenQuotes(line, reqPos);
      if (dep) deps.push(dep);
    }
  }
  return deps;
}

function parseCppDeps(content) {
  const deps = [];
  for (const line of content.split('\n')) {
    const incPos = line.indexOf('#include');
    if (incPos !== -1) {
      const q1 = line.indexOf('"', incPos);
      if (q1 !== -1) {
        const q2 = line.indexOf('"', q1 + 1);
        if (q2 !== -1) deps.push(line.slice(q1 + 1, q2));
      }
    }
  }
  return deps;
}

function parsePythonDeps(content) {
  const deps = [];
  for (const line of content.split('\n')) {
    const fromPos = line.indexOf('from ');
    if (fromPos !== -1 && fromPos < 5) {
      const importPos = line.indexOf(' import', fromPos);
      if (importPos !== -1) {
        const mod = line.slice(fromPos + 5, importPos).trim();
        if (mod) { deps.push(mod); continue; }
      }
    }
    const impPos = line.indexOf('import ');
    if (impPos !== -1 && impPos < 5) {
      let mod = line.slice(impPos + 7).trim();
      const comma = mod.indexOf(',');
      if (comma !== -1) mod = mod.slice(0, comma).trim();
      if (mod) deps.push(mod);
    }
  }
  return deps;
}

function shouldSkipDep(dep) {
  if (dep.includes('node_modules')) return true;
  if (dep[0] === '@') return true;
  if (dep[0] !== '.' && !dep.includes('/')) return true;
  return false;
}

// ── Main parser ─────────────────────────────────────────────────────────────

/**
 * Recursively walk a directory and build hierarchical nodes + dependency links.
 *
 * @param {string} extractedDir — absolute path to the repo root
 * @returns {Promise<{nodes: Array, links: Array}>}
 */
async function runParser(extractedDir) {
  const nodes = [];
  const nodeMap = new Map();   // id → node
  const fileNodes = [];        // only files (for dependency pass)
  const folderChildren = {};   // folderId → count of direct children

  // ── Root node ───────────────────────────────────────────────────
  const rootNode = {
    id: '__root__',
    label: path.basename(extractedDir),
    type: 'folder',
    group: 'shared',
    parent: null,
    childCount: 0,
  };
  nodes.push(rootNode);
  nodeMap.set('__root__', rootNode);
  folderChildren['__root__'] = 0;

  // ── Recursive walk ──────────────────────────────────────────────
  function walk(dir, parentId) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch { return; }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      let relPath = path.relative(extractedDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        const group = classifyGroup(relPath);
        const folderNode = {
          id: relPath,
          label: entry.name,
          type: 'folder',
          group,
          parent: parentId,
          childCount: 0,
        };
        nodes.push(folderNode);
        nodeMap.set(relPath, folderNode);
        folderChildren[relPath] = 0;

        // Increment parent's child count
        folderChildren[parentId] = (folderChildren[parentId] || 0) + 1;

        walk(fullPath, relPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

        let content;
        try {
          content = fs.readFileSync(fullPath, 'utf8');
        } catch { continue; }

        const lineCount = content.split('\n').length;
        const size = Math.max(4, Math.round(Math.log2(lineCount + 1) * 3));
        const group = classifyGroup(relPath);

        const fileNode = {
          id: relPath,
          label: entry.name,
          type: 'file',
          group,
          parent: parentId,
          size,
          lineCount,
          _fullPath: fullPath,   // temporary, for dependency resolution
          _content: content,     // temporary
        };
        nodes.push(fileNode);
        nodeMap.set(relPath, fileNode);
        fileNodes.push(fileNode);

        // Increment parent's child count
        folderChildren[parentId] = (folderChildren[parentId] || 0) + 1;
      }
    }
  }

  walk(extractedDir, '__root__');

  // ── Update childCount on folder nodes ──────────────────────────
  for (const node of nodes) {
    if (node.type === 'folder' && folderChildren[node.id] !== undefined) {
      node.childCount = folderChildren[node.id];
    }
  }

  // ── Build a set of known file IDs for link resolution ──────────
  const knownFileIds = new Set();
  for (const n of fileNodes) knownFileIds.add(n.id);

  // ── Parse dependencies and create links ────────────────────────
  const links = [];

  for (const node of fileNodes) {
    const ext = path.extname(node.label);
    let deps = [];

    if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
      deps = parseJSDeps(node._content);
    } else if (['.cpp', '.cc', '.h', '.hpp'].includes(ext)) {
      deps = parseCppDeps(node._content);
    } else if (ext === '.py') {
      deps = parsePythonDeps(node._content);
    }

    for (const dep of deps) {
      if (shouldSkipDep(dep)) continue;

      const currentDir = path.posix.dirname(node.id);
      const target = path.posix.normalize(path.posix.join(currentDir, dep));

      const candidates = [
        target,
        target + '.js', target + '.jsx',
        target + '.ts', target + '.tsx',
        target + '/index.js', target + '/index.tsx',
      ];

      for (const candidate of candidates) {
        if (knownFileIds.has(candidate)) {
          links.push({ source: node.id, target: candidate, type: 'import' });
          break;
        }
      }
    }

    // Clean up temporaries
    delete node._fullPath;
    delete node._content;
  }

  // ── Remove empty folders (no supported-file descendants) ───────
  const usefulFolders = new Set();
  for (const fn of fileNodes) {
    let pid = fn.parent;
    while (pid && pid !== '__root__') {
      usefulFolders.add(pid);
      const parentNode = nodeMap.get(pid);
      pid = parentNode ? parentNode.parent : null;
    }
  }

  const finalNodes = nodes.filter(n =>
    n.type === 'file' ||
    n.id === '__root__' ||
    usefulFolders.has(n.id)
  );

  return { nodes: finalNodes, links };
}

// ── Cleanup ─────────────────────────────────────────────────────────────────

function cleanupFiles(zipPath, extractedDir) {
  try {
    if (zipPath) {
      fs.rmSync(zipPath, { force: true });
      console.log(`[Cleanup] Deleted ZIP: ${zipPath}`);
    }
  } catch (err) {
    console.error(`[Cleanup] Failed to delete ZIP: ${err.message}`);
  }

  try {
    if (extractedDir) {
      const parentDir = path.dirname(extractedDir);
      if (parentDir.includes('repo-')) {
        fs.rmSync(parentDir, { recursive: true, force: true });
        console.log(`[Cleanup] Deleted folder: ${parentDir}`);
      } else {
        fs.rmSync(extractedDir, { recursive: true, force: true });
        console.log(`[Cleanup] Deleted folder: ${extractedDir}`);
      }
    }
  } catch (err) {
    console.error(`[Cleanup] Failed to delete folder: ${err.message}`);
  }
}

module.exports = { runParser, cleanupFiles };
