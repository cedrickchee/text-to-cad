import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import {
  DEFAULT_EXPLORER_ROOT_DIR,
  EXPLORER_SKIPPED_DIRECTORIES,
  isCatalogRelevantPath,
  isServedCadAsset,
  normalizeExplorerRootDir,
  repoRelativePath,
  resolveExplorerRoot,
  scanCadDirectory,
} from "./lib/cadDirectoryScanner.mjs";
import {
  normalizeExplorerDefaultFile,
  normalizeExplorerGithubUrl,
} from "./lib/explorerConfig.mjs";
import {
  DEFAULT_EXPLORER_PORT,
  buildExplorerServerInfo,
  normalizeExplorerPort,
} from "./lib/explorerServerInfo.mjs";

const explorerPort = normalizeExplorerPort(process.env.EXPLORER_PORT, DEFAULT_EXPLORER_PORT);
const explorerHost = process.env.EXPLORER_HOST || "127.0.0.1";
const explorerAllowedHosts = normalizeAllowedHosts(process.env.EXPLORER_ALLOWED_HOSTS);
const explorerAppRoot = path.dirname(fileURLToPath(import.meta.url));
const defaultWorkspaceRoot = path.resolve(explorerAppRoot, "../../../..");
const workspaceRoot = resolveWorkspaceRoot();
const repoRoot = workspaceRoot;
const buildExplorerRootDir = normalizeExplorerRootDir(process.env.EXPLORER_ROOT_DIR ?? DEFAULT_EXPLORER_ROOT_DIR);
const buildExplorerDefaultFile = normalizeExplorerDefaultFile(process.env.EXPLORER_DEFAULT_FILE ?? "");
const buildExplorerGithubUrl = normalizeExplorerGithubUrl(process.env.EXPLORER_GITHUB_URL ?? "");

function resolveWorkspaceRoot() {
  if (process.env.EXPLORER_WORKSPACE_ROOT) {
    return path.resolve(process.env.EXPLORER_WORKSPACE_ROOT);
  }

  const resolvedExplorerAppRoot = path.resolve(explorerAppRoot);
  for (const candidate of [process.env.INIT_CWD, process.cwd()]) {
    if (!candidate) {
      continue;
    }
    const resolvedCandidate = path.resolve(candidate);
    if (resolvedCandidate !== resolvedExplorerAppRoot && !pathIsInside(resolvedCandidate, resolvedExplorerAppRoot)) {
      return resolvedCandidate;
    }
  }

  return defaultWorkspaceRoot;
}

function normalizeAllowedHosts(rawValue = "") {
  const hosts = String(rawValue)
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
  return hosts.length ? hosts : [".vercel.run"];
}

function withExplorerConfig(catalog) {
  return {
    ...catalog,
    config: {
      ...(catalog?.config && typeof catalog.config === "object" ? catalog.config : {}),
      defaultFile: buildExplorerDefaultFile,
      githubUrl: buildExplorerGithubUrl,
    },
  };
}

function emptyCatalog(rootDir = DEFAULT_EXPLORER_ROOT_DIR) {
  const normalizedDir = normalizeExplorerRootDir(rootDir);
  return {
    schemaVersion: 3,
    root: {
      dir: normalizedDir,
      name: normalizedDir ? path.basename(normalizedDir) : path.basename(workspaceRoot),
      path: normalizedDir,
    },
    entries: [],
  };
}

function readCadCatalog(rootDir = buildExplorerRootDir) {
  try {
    return withExplorerConfig(scanCadDirectory({ repoRoot, rootDir }));
  } catch {
    return withExplorerConfig(emptyCatalog(rootDir));
  }
}

function pathIsInside(childPath, parentPath) {
  const relativePath = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return Boolean(relativePath) && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function serveStaticFile(root, req, res, next, { allow } = {}) {
  const requestPath = String(req.url || "").replace(/\?.*$/, "");
  let decodedRequestPath = "";
  try {
    decodedRequestPath = decodeURIComponent(requestPath);
  } catch {
    res.statusCode = 400;
    res.end("Bad request");
    return true;
  }
  const filePath = path.resolve(root, decodedRequestPath.replace(/^\/+/, ""));
  if (
    !(filePath === path.resolve(root) || pathIsInside(filePath, root))
    || (typeof allow === "function" && !allow(filePath))
  ) {
    res.statusCode = 403;
    res.end("Forbidden");
    return true;
  }
  fs.stat(filePath, (error, stats) => {
    if (res.destroyed) {
      return;
    }
    if (error || !stats.isFile()) {
      next();
      return;
    }
    if (path.extname(filePath).toLowerCase() === ".js" || path.extname(filePath).toLowerCase() === ".mjs") {
      res.setHeader("content-type", "text/javascript; charset=utf-8");
    }
    res.setHeader("content-length", String(stats.size));
    const stream = fs.createReadStream(filePath);
    res.on("close", () => {
      if (!res.writableEnded) {
        stream.destroy();
      }
    });
    stream.on("error", () => {
      if (!res.headersSent) {
        next();
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  });
  return true;
}

function copyRecursiveFiltered(sourceRoot, destinationRoot, predicate) {
  if (!fs.existsSync(sourceRoot)) {
    return;
  }
  for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
    const sourcePath = path.join(sourceRoot, entry.name);
    const destinationPath = path.join(destinationRoot, entry.name);
    if (entry.isDirectory()) {
      if (EXPLORER_SKIPPED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      copyRecursiveFiltered(sourcePath, destinationPath, predicate);
      continue;
    }
    if (!predicate(sourcePath)) {
      continue;
    }
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, destinationPath);
  }
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
}

function cadCatalogPlugin() {
  const virtualId = "virtual:cad-catalog";
  const resolvedVirtualId = `\0${virtualId}`;
  let resolvedConfig = null;
  const activeDirectories = new Map();
  const refreshTimers = new Map();

  function activateDirectory(server, rootDir) {
    const resolved = resolveExplorerRoot(repoRoot, rootDir);
    const wasActive = activeDirectories.has(resolved.rootPath);
    activeDirectories.set(resolved.rootPath, resolved.dir);
    if (!wasActive) {
      server.watcher.add(resolved.rootPath);
    }
    return resolved;
  }

  function scheduleCatalogRefresh(server, rootPath, dir) {
    if (refreshTimers.has(rootPath)) {
      clearTimeout(refreshTimers.get(rootPath));
    }
    refreshTimers.set(rootPath, setTimeout(() => {
      refreshTimers.delete(rootPath);
      const virtualCatalogModule = server.moduleGraph.getModuleById(resolvedVirtualId);
      if (virtualCatalogModule) {
        server.moduleGraph.invalidateModule(virtualCatalogModule);
      }
      server.ws.send({
        type: "custom",
        event: "cad-catalog:changed",
        data: { dir },
      });
    }, 150));
  }

  function notifyChangedPath(server, changedPath) {
    const resolvedChangedPath = path.resolve(changedPath);
    if (!isCatalogRelevantPath(resolvedChangedPath)) {
      return;
    }
    for (const [rootPath, dir] of activeDirectories.entries()) {
      if (resolvedChangedPath === rootPath || pathIsInside(resolvedChangedPath, rootPath)) {
        scheduleCatalogRefresh(server, rootPath, dir);
      }
    }
  }

  return {
    name: "cad-catalog",
    configResolved(config) {
      resolvedConfig = config;
    },
    resolveId(id) {
      if (id === virtualId) {
        return resolvedVirtualId;
      }
      return null;
    },
    load(id) {
      if (id !== resolvedVirtualId) {
        return null;
      }
      const catalog = readCadCatalog(buildExplorerRootDir);
      return `export default ${JSON.stringify(catalog)};`;
    },
    configureServer(server) {
      const servedExplorerRoot = activateDirectory(server, buildExplorerRootDir);
      server.middlewares.use((req, res, next) => {
        const requestUrl = new URL(req.url || "/", "http://localhost");
        if (requestUrl.pathname !== "/__cad/server") {
          next();
          return;
        }
        sendJson(res, 200, buildExplorerServerInfo({
          workspaceRoot: repoRoot,
          rootDir: buildExplorerRootDir,
          port: explorerPort,
          pid: process.pid,
        }));
      });
      server.middlewares.use((req, res, next) => {
        const requestUrl = new URL(req.url || "/", "http://localhost");
        if (requestUrl.pathname !== "/__cad/catalog") {
          next();
          return;
        }
        let catalog;
        try {
          const resolved = activateDirectory(server, buildExplorerRootDir);
          catalog = withExplorerConfig(scanCadDirectory({ repoRoot, rootDir: resolved.dir }));
        } catch (error) {
          sendJson(res, 400, {
            error: error instanceof Error ? error.message : String(error),
          });
          return;
        }
        sendJson(res, 200, catalog);
      });
      server.middlewares.use((req, res, next) => {
        const requestPath = String(req.url || "").replace(/\?.*$/, "");
        let decodedRequestPath = "";
        try {
          decodedRequestPath = decodeURIComponent(requestPath);
        } catch {
          next();
          return;
        }
        const candidatePath = path.resolve(repoRoot, decodedRequestPath.replace(/^\/+/, ""));
        if (!isServedCadAsset(candidatePath)) {
          next();
          return;
        }
        if (!(candidatePath === servedExplorerRoot.rootPath || pathIsInside(candidatePath, servedExplorerRoot.rootPath))) {
          res.statusCode = 403;
          res.end("Forbidden");
          return;
        }
        serveStaticFile(repoRoot, req, res, next, {
          allow: (filePath) => (
            isServedCadAsset(filePath) &&
            (filePath === servedExplorerRoot.rootPath || pathIsInside(filePath, servedExplorerRoot.rootPath))
          ),
        });
      });
      for (const eventName of ["add", "change", "unlink"]) {
        server.watcher.on(eventName, (changedPath) => notifyChangedPath(server, changedPath));
      }
    },
    writeBundle() {
      const outDir = resolvedConfig?.build?.outDir || "dist";
      const resolved = resolveExplorerRoot(repoRoot, buildExplorerRootDir);
      const cadDestinationRoot = path.resolve(explorerAppRoot, outDir, repoRelativePath(repoRoot, resolved.rootPath));
      copyRecursiveFiltered(resolved.rootPath, cadDestinationRoot, (filePath) => {
        return isServedCadAsset(filePath);
      });
    },
  };
}

export default defineConfig({
  root: explorerAppRoot,
  envPrefix: "EXPLORER_",
  plugins: [react(), cadCatalogPlugin()],
  resolve: {
    alias: {
      "@": explorerAppRoot,
    },
  },
  esbuild: {
    loader: "jsx",
    include: /.*\.[jt]sx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        ".js": "jsx",
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }
          if (id.includes("/three/")) {
            return "vendor-three";
          }
          if (id.includes("/react/") || id.includes("/react-dom/")) {
            return "vendor-react";
          }
          if (id.includes("/radix-ui/") || id.includes("/@radix-ui/")) {
            return "vendor-ui";
          }
          if (id.includes("/lucide-react/")) {
            return "vendor-icons";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    host: explorerHost,
    port: explorerPort,
    strictPort: true,
    allowedHosts: explorerAllowedHosts,
  },
  preview: {
    host: explorerHost,
    port: explorerPort,
    strictPort: true,
  },
});
