import { spawnSync, execFile } from 'node:child_process';

export interface WinForegroundProbeRuntime {
  runCommand: (command: string, args: string[]) => { status: number | null; stdout: string };
  runCommandAsync?: (command: string, args: string[]) => Promise<{ status: number | null; stdout: string }>;
}

const createRuntime = (): WinForegroundProbeRuntime => ({
  runCommand: (command, args) => {
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 3000,
    });
    return {
      status: result.status,
      stdout: result.stdout ?? '',
    };
  },
  runCommandAsync: (command, args) =>
    new Promise((resolve) => {
      execFile(
        command,
        args,
        { encoding: 'utf8', windowsHide: true, timeout: 3000 },
        (error, stdout) => {
          resolve({
            status: error ? 1 : 0,
            stdout: stdout ?? '',
          });
        },
      );
    }),
});

/** Processes to skip when walking the tree — these are infrastructure, not user processes. */
const IGNORED_PROCESSES = new Set([
  'conhost.exe',
  'conhost',
]);

/**
 * Cache for the process tree query to avoid spawning PowerShell too frequently
 * when multiple terminals refresh near-simultaneously.
 */
let cachedProcessTree: {
  childrenMap: Map<number, { pid: number; name: string; creationDate: string }[]>;
  timestamp: number;
} | null = null;

/** In-flight async query promise for deduplication. */
let inflightQuery: Promise<Map<number, { pid: number; name: string; creationDate: string }[]> | null> | null = null;

const CACHE_TTL_MS = 400;

/**
 * On Windows with ConPTY, `node-pty`'s `.process` property returns the PTY name
 * (e.g. `xterm-256color`) instead of the actual foreground process. This function
 * uses PowerShell's Get-CimInstance to query the process tree from the shell PID
 * and find the deepest child, which is the foreground process the user is
 * interacting with.
 *
 * The approach: query ALL processes in one shot to build a parent→children map,
 * then walk the tree from the shell PID to find the deepest (most recently
 * spawned) leaf process. This avoids making recursive shell calls.
 */
export const probeWindowsForegroundProcess = (
  shellPid: number | null,
  runtime: WinForegroundProbeRuntime = createRuntime(),
): string | undefined => {
  if (shellPid === null || shellPid <= 0) {
    return undefined;
  }

  try {
    const childrenMap = getProcessChildrenMap(runtime);
    if (!childrenMap) {
      return undefined;
    }

    return findDeepestChild(shellPid, childrenMap);
  } catch {
    return undefined;
  }
};

/** PowerShell command that outputs "PID,ParentPID,CreationDate,Name" per line. */
const PS_PROCESS_QUERY = 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId),$($_.ParentProcessId),$($_.CreationDate),$($_.Name)" }';

const PS_ARGS = ['-NoProfile', '-NoLogo', '-Command', PS_PROCESS_QUERY];

/**
 * Parse the PowerShell output into a parent → children map.
 * All processes are kept in the map (including ignored ones like conhost.exe);
 * ignored processes are filtered during traversal instead.
 * Children are sorted by CreationDate so the "last child" heuristic is stable.
 */
const parseProcessTree = (
  stdout: string,
): Map<number, { pid: number; name: string; creationDate: string }[]> => {
  const childrenMap = new Map<number, { pid: number; name: string; creationDate: string }[]>();
  const lines = stdout.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }

    // Format: "PID,ParentPID,CreationDate,Name"
    const firstComma = trimmed.indexOf(',');
    const secondComma = trimmed.indexOf(',', firstComma + 1);
    const thirdComma = trimmed.indexOf(',', secondComma + 1);
    if (firstComma === -1 || secondComma === -1 || thirdComma === -1) {
      // Fallback: support old "PID,ParentPID,Name" format (e.g. in tests)
      if (firstComma !== -1 && secondComma !== -1) {
        const pid = parseInt(trimmed.slice(0, firstComma), 10);
        const parentPid = parseInt(trimmed.slice(firstComma + 1, secondComma), 10);
        const name = trimmed.slice(secondComma + 1).trim();
        if (!isNaN(pid) && !isNaN(parentPid) && name.length > 0) {
          if (!childrenMap.has(parentPid)) {
            childrenMap.set(parentPid, []);
          }
          childrenMap.get(parentPid)!.push({ pid, name, creationDate: '' });
        }
      }
      continue;
    }

    const pid = parseInt(trimmed.slice(0, firstComma), 10);
    const parentPid = parseInt(trimmed.slice(firstComma + 1, secondComma), 10);
    const creationDate = trimmed.slice(secondComma + 1, thirdComma).trim();
    const name = trimmed.slice(thirdComma + 1).trim();

    if (isNaN(pid) || isNaN(parentPid) || name.length === 0) {
      continue;
    }

    // Keep ALL processes in the map — ignored ones are skipped during traversal
    if (!childrenMap.has(parentPid)) {
      childrenMap.set(parentPid, []);
    }
    childrenMap.get(parentPid)!.push({ pid, name, creationDate });
  }

  // Sort children by CreationDate so the "last child" heuristic is deterministic
  for (const children of childrenMap.values()) {
    children.sort((a, b) => a.creationDate.localeCompare(b.creationDate));
  }

  return childrenMap;
};

const getProcessChildrenMap = (
  runtime: WinForegroundProbeRuntime,
): Map<number, { pid: number; name: string; creationDate: string }[]> | null => {
  const now = Date.now();

  // Return cached result if still fresh
  if (cachedProcessTree && now - cachedProcessTree.timestamp < CACHE_TTL_MS) {
    return cachedProcessTree.childrenMap;
  }

  const result = runtime.runCommand('powershell.exe', PS_ARGS);

  if (result.status !== 0) {
    return null;
  }

  const childrenMap = parseProcessTree(result.stdout);
  cachedProcessTree = { childrenMap, timestamp: now };
  return childrenMap;
};

/**
 * Async version of getProcessChildrenMap. Uses execFile to avoid blocking the
 * event loop, and deduplicates concurrent calls via an in-flight promise.
 */
const getProcessChildrenMapAsync = async (
  runtime: WinForegroundProbeRuntime,
): Promise<Map<number, { pid: number; name: string; creationDate: string }[]> | null> => {
  const now = Date.now();

  if (cachedProcessTree && now - cachedProcessTree.timestamp < CACHE_TTL_MS) {
    return cachedProcessTree.childrenMap;
  }

  // Deduplicate concurrent async calls
  if (inflightQuery) {
    return inflightQuery;
  }

  const runAsync = runtime.runCommandAsync;
  if (!runAsync) {
    // Fallback to sync if async not available
    return getProcessChildrenMap(runtime);
  }

  inflightQuery = (async () => {
    try {
      const result = await runAsync('powershell.exe', PS_ARGS);
      if (result.status !== 0) {
        return null;
      }
      const childrenMap = parseProcessTree(result.stdout);
      cachedProcessTree = { childrenMap, timestamp: Date.now() };
      return childrenMap;
    } finally {
      inflightQuery = null;
    }
  })();

  return inflightQuery;
};

/**
 * Walk down the process tree from a given PID, always preferring the last child
 * (most recently created, after sorting by CreationDate). Returns the name of
 * the deepest leaf process, or undefined if no children exist.
 *
 * Ignored processes (e.g. conhost.exe) are treated as transparent: their
 * children are traversed as if they belong to the ignored process's parent,
 * so intermediate ignored nodes never break the chain.
 */
const findDeepestChild = (
  startPid: number,
  childrenMap: Map<number, { pid: number; name: string; creationDate: string }[]>,
  visited = new Set<number>(),
): string | undefined => {
  if (visited.has(startPid)) {
    return undefined;
  }
  visited.add(startPid);

  const children = childrenMap.get(startPid);
  if (!children || children.length === 0) {
    return undefined;
  }

  // Walk children from last (most recently created) to first
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i];

    // Treat ignored processes as transparent — traverse through them
    if (IGNORED_PROCESSES.has(child.name.toLowerCase())) {
      const throughIgnored = findDeepestChild(child.pid, childrenMap, visited);
      if (throughIgnored) {
        return throughIgnored;
      }
      // If the ignored process has no meaningful children, skip it
      continue;
    }

    // Try to go deeper into this non-ignored child
    const deeper = findDeepestChild(child.pid, childrenMap, visited);
    return deeper ?? stripExeExtension(child.name);
  }

  return undefined;
};

const stripExeExtension = (name: string): string => {
  return name.replace(/\.exe$/i, '');
};

/**
 * Async version of probeWindowsForegroundProcess. Uses non-blocking execFile
 * instead of spawnSync, and deduplicates concurrent queries.
 */
export const probeWindowsForegroundProcessAsync = async (
  shellPid: number | null,
  runtime: WinForegroundProbeRuntime = createRuntime(),
): Promise<string | undefined> => {
  if (shellPid === null || shellPid <= 0) {
    return undefined;
  }

  try {
    const childrenMap = await getProcessChildrenMapAsync(runtime);
    if (!childrenMap) {
      return undefined;
    }

    return findDeepestChild(shellPid, childrenMap);
  } catch {
    return undefined;
  }
};

/** @internal Reset the process tree cache. Exposed for testing only. */
export const _resetCache = (): void => {
  cachedProcessTree = null;
  inflightQuery = null;
};
