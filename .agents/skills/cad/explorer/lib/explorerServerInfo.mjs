import path from "node:path";

import {
  DEFAULT_EXPLORER_ROOT_DIR,
  normalizeExplorerRootDir,
  resolveExplorerRoot,
} from "./cadDirectoryScanner.mjs";

export const EXPLORER_SERVER_INFO_SCHEMA_VERSION = 1;
export const EXPLORER_SERVER_APP_ID = "cad-explorer";
export const DEFAULT_EXPLORER_HOST = "127.0.0.1";
export const DEFAULT_EXPLORER_PORT = 4178;

export function normalizeExplorerPort(value, fallback = DEFAULT_EXPLORER_PORT) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
    return parsed;
  }
  return fallback;
}

export function buildExplorerServerInfo({
  workspaceRoot,
  rootDir = DEFAULT_EXPLORER_ROOT_DIR,
  port = DEFAULT_EXPLORER_PORT,
  pid = process.pid,
  host = DEFAULT_EXPLORER_HOST,
  publicBaseUrl = process.env.EXPLORER_PUBLIC_BASE_URL,
} = {}) {
  if (!workspaceRoot) {
    throw new Error("workspaceRoot is required");
  }
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  const normalizedRootDir = normalizeExplorerRootDir(rootDir);
  const resolvedExplorerRoot = resolveExplorerRoot(resolvedWorkspaceRoot, normalizedRootDir);
  const normalizedPort = normalizeExplorerPort(port);
  return {
    schemaVersion: EXPLORER_SERVER_INFO_SCHEMA_VERSION,
    app: EXPLORER_SERVER_APP_ID,
    workspaceRoot: resolvedWorkspaceRoot,
    rootDir: resolvedExplorerRoot.dir,
    rootPath: resolvedExplorerRoot.rootPath,
    port: normalizedPort,
    pid: Number.isInteger(pid) ? pid : process.pid,
    url: publicBaseUrl || `http://${host}:${normalizedPort}`,
  };
}

export function isExplorerServerInfo(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    value.app === EXPLORER_SERVER_APP_ID &&
    typeof value.rootPath === "string" &&
    Number.isInteger(value.port)
  );
}
