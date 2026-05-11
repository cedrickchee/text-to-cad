#!/usr/bin/env node
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import {
  DEFAULT_EXPLORER_ROOT_DIR,
  normalizeExplorerRootDir,
  resolveExplorerRoot,
} from "../lib/cadDirectoryScanner.mjs";
import {
  DEFAULT_EXPLORER_HOST,
  DEFAULT_EXPLORER_PORT,
  isExplorerServerInfo,
  normalizeExplorerPort,
} from "../lib/explorerServerInfo.mjs";

export const DEFAULT_PORT_END = 4198;
export const DEFAULT_PROBE_TIMEOUT_MS = 200;
export const DEFAULT_START_TIMEOUT_MS = 30_000;
export const DEFAULT_READY_INTERVAL_MS = 100;

const require = createRequire(import.meta.url);
const scriptPath = fileURLToPath(import.meta.url);
const explorerAppRoot = path.resolve(path.dirname(scriptPath), "..");
const defaultWorkspaceRoot = path.resolve(explorerAppRoot, "../../../..");

function toPosixPath(value) {
  return String(value || "").split(path.sep).join("/");
}

function pathIsInside(childPath, parentPath) {
  const relativePath = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return Boolean(relativePath) && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function pathIsInsideOrEqual(childPath, parentPath) {
  return path.resolve(childPath) === path.resolve(parentPath) || pathIsInside(childPath, parentPath);
}

function encodeFileParam(filePath) {
  return toPosixPath(filePath)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRequiredValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parsePort(value, flag) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`${flag} must be a TCP port from 1 to 65535`);
  }
  return parsed;
}

export function parseEnsureDevArgs(argv = []) {
  const options = {
    workspaceRoot: "",
    rootDir: "",
    file: "",
    port: null,
    portEnd: null,
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg.startsWith("--workspace-root=")) {
      options.workspaceRoot = arg.slice("--workspace-root=".length);
      continue;
    }
    if (arg === "--workspace-root") {
      options.workspaceRoot = parseRequiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith("--root-dir=")) {
      options.rootDir = arg.slice("--root-dir=".length);
      continue;
    }
    if (arg === "--root-dir") {
      options.rootDir = parseRequiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith("--file=")) {
      options.file = arg.slice("--file=".length);
      continue;
    }
    if (arg === "--file") {
      options.file = parseRequiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith("--port=")) {
      options.port = parsePort(arg.slice("--port=".length), "--port");
      continue;
    }
    if (arg === "--port") {
      options.port = parsePort(parseRequiredValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg.startsWith("--port-end=")) {
      options.portEnd = parsePort(arg.slice("--port-end=".length), "--port-end");
      continue;
    }
    if (arg === "--port-end") {
      options.portEnd = parsePort(parseRequiredValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

export function resolveWorkspaceRoot({
  workspaceRoot = "",
  env = process.env,
  cwd = process.cwd(),
  appRoot = explorerAppRoot,
} = {}) {
  const explicitRoot = workspaceRoot || env.EXPLORER_WORKSPACE_ROOT || "";
  if (explicitRoot) {
    return path.resolve(cwd, explicitRoot);
  }

  const resolvedAppRoot = path.resolve(appRoot);
  for (const candidate of [env.INIT_CWD, cwd]) {
    if (!candidate) {
      continue;
    }
    const resolvedCandidate = path.resolve(candidate);
    if (resolvedCandidate !== resolvedAppRoot && !pathIsInside(resolvedCandidate, resolvedAppRoot)) {
      return resolvedCandidate;
    }
  }

  return defaultWorkspaceRoot;
}

function chooseFileCandidate(rawFile, { workspaceRoot, rootPath, cwd }) {
  const candidates = [];
  if (path.isAbsolute(rawFile)) {
    candidates.push(path.resolve(rawFile));
  } else {
    candidates.push(path.resolve(workspaceRoot, rawFile));
    candidates.push(path.resolve(rootPath, rawFile));
    candidates.push(path.resolve(cwd, rawFile));
  }

  const uniqueCandidates = [...new Set(candidates)];
  const insideCandidates = uniqueCandidates.filter((candidate) => pathIsInsideOrEqual(candidate, rootPath));
  if (!insideCandidates.length) {
    throw new Error(`Explorer file must be inside the scan root: ${rawFile}`);
  }

  return insideCandidates[0];
}

export function resolveEnsureDevRequest({
  options = {},
  env = process.env,
  cwd = process.cwd(),
  appRoot = explorerAppRoot,
} = {}) {
  const workspaceRoot = resolveWorkspaceRoot({
    workspaceRoot: options.workspaceRoot,
    env,
    cwd,
    appRoot,
  });
  const rootDir = normalizeExplorerRootDir(
    options.rootDir || env.EXPLORER_ROOT_DIR || DEFAULT_EXPLORER_ROOT_DIR
  );
  const resolvedRoot = resolveExplorerRoot(workspaceRoot, rootDir);
  let fileParam = "";
  if (options.file) {
    const filePath = chooseFileCandidate(options.file, {
      workspaceRoot,
      rootPath: resolvedRoot.rootPath,
      cwd,
    });
    fileParam = toPosixPath(path.relative(resolvedRoot.rootPath, filePath));
  }

  const port = options.port || normalizeExplorerPort(env.EXPLORER_PORT, DEFAULT_EXPLORER_PORT);
  const envPortEnd = env.EXPLORER_PORT_END
    ? parsePort(env.EXPLORER_PORT_END, "EXPLORER_PORT_END")
    : DEFAULT_PORT_END;
  const portEnd = options.portEnd || envPortEnd;
  if (portEnd < port) {
    throw new Error("--port-end must be greater than or equal to --port");
  }

  return {
    workspaceRoot,
    rootDir,
    rootPath: resolvedRoot.rootPath,
    fileParam,
    port,
    portEnd,
  };
}

export function buildExplorerUrl(serverInfo, fileParam = "") {
  const url = new URL(serverInfo?.url || `http://${DEFAULT_EXPLORER_HOST}:${serverInfo.port}`);
  url.pathname = "/";
  url.search = "";
  if (fileParam) {
    url.search = `?file=${encodeFileParam(fileParam)}`;
  }
  return url.href;
}

export function probeExplorerServer(port, {
  host = process.env.EXPLORER_HOST || DEFAULT_EXPLORER_HOST,
  timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
} = {}) {
  return new Promise((resolve) => {
    const req = http.get({
      hostname: host,
      port,
      path: "/__cad/server",
      timeout: timeoutMs,
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        resolve(null);
        return;
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
        if (body.length > 64 * 1024) {
          req.destroy();
          resolve(null);
        }
      });
      res.on("end", () => {
        try {
          const payload = JSON.parse(body);
          resolve(isExplorerServerInfo(payload) ? payload : null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
    req.on("error", () => resolve(null));
  });
}

export function canBindPort(port, { host = process.env.EXPLORER_HOST || DEFAULT_EXPLORER_HOST } = {}) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

export async function selectExplorerServer({
  rootPath,
  port,
  portEnd,
  probeServer = probeExplorerServer,
  canBind = canBindPort,
} = {}) {
  const resolvedRootPath = path.resolve(rootPath);
  for (let candidatePort = port; candidatePort <= portEnd; candidatePort += 1) {
    const serverInfo = await probeServer(candidatePort);
    if (isExplorerServerInfo(serverInfo)) {
      if (path.resolve(serverInfo.rootPath) === resolvedRootPath) {
        return {
          action: "reuse",
          port: candidatePort,
          serverInfo,
        };
      }
      continue;
    }
    if (await canBind(candidatePort)) {
      return {
        action: "start",
        port: candidatePort,
        serverInfo: null,
      };
    }
  }
  throw new Error(`No available CAD Explorer port found in ${port}-${portEnd}`);
}

export function buildViteSpawnOptions({ workspaceRoot, rootDir, port, env = process.env } = {}) {
  const viteBin = path.join(path.dirname(require.resolve("vite/package.json")), "bin", "vite.js");
  return {
    command: process.execPath,
    args: [viteBin, "dev"],
    options: {
      cwd: explorerAppRoot,
      detached: true,
      stdio: "ignore",
      env: {
        ...env,
        EXPLORER_WORKSPACE_ROOT: workspaceRoot,
        EXPLORER_ROOT_DIR: rootDir,
        EXPLORER_HOST: env.EXPLORER_HOST || DEFAULT_EXPLORER_HOST,
        EXPLORER_PORT: String(port),
      },
    },
  };
}

export function startViteDevServer(request, spawnImpl = spawn) {
  const spawnOptions = buildViteSpawnOptions(request);
  const child = spawnImpl(spawnOptions.command, spawnOptions.args, spawnOptions.options);
  child.unref?.();
  return child;
}

export async function waitForMatchingServer({
  rootPath,
  port,
  timeoutMs = DEFAULT_START_TIMEOUT_MS,
  intervalMs = DEFAULT_READY_INTERVAL_MS,
  probeServer = probeExplorerServer,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  const resolvedRootPath = path.resolve(rootPath);
  while (Date.now() < deadline) {
    const serverInfo = await probeServer(port);
    if (isExplorerServerInfo(serverInfo) && path.resolve(serverInfo.rootPath) === resolvedRootPath) {
      return serverInfo;
    }
    await sleep(intervalMs);
  }
  throw new Error(`CAD Explorer did not become ready on port ${port}`);
}

export function formatEnsureDevResult({ action, serverInfo, fileParam, json = false } = {}) {
  const url = buildExplorerUrl(serverInfo, fileParam);
  if (json) {
    return `${JSON.stringify({
      action,
      url,
      server: serverInfo,
    }, null, 2)}\n`;
  }
  return `${url}\n`;
}

export function helpText() {
  return `Usage: npm run dev:ensure -- [options]

Options:
  --workspace-root <path>  Workspace root to scan. Defaults to INIT_CWD.
  --root-dir <path>        Scan subdirectory inside the workspace root.
  --file <path>            File to open; accepts absolute, workspace-relative, or scan-root-relative paths.
  --port <number>          First port to probe. Defaults to 4178 or EXPLORER_PORT.
  --port-end <number>      Last port to probe. Defaults to 4198.
  --json                   Print structured JSON instead of just the Explorer URL.
`;
}

export async function runEnsureDev(argv = process.argv.slice(2), {
  env = process.env,
  cwd = process.cwd(),
  stdout = process.stdout,
  stderr = process.stderr,
  spawnImpl = spawn,
} = {}) {
  const options = parseEnsureDevArgs(argv);
  if (options.help) {
    stdout.write(helpText());
    return 0;
  }

  const request = resolveEnsureDevRequest({ options, env, cwd });
  const selection = await selectExplorerServer(request);
  let serverInfo = selection.serverInfo;
  if (selection.action === "start") {
    startViteDevServer({
      workspaceRoot: request.workspaceRoot,
      rootDir: request.rootDir,
      port: selection.port,
      env,
    }, spawnImpl);
    serverInfo = await waitForMatchingServer({
      rootPath: request.rootPath,
      port: selection.port,
    });
  }

  stdout.write(formatEnsureDevResult({
    action: selection.action === "start" ? "started" : "reused",
    serverInfo,
    fileParam: request.fileParam,
    json: options.json,
  }));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  runEnsureDev().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
