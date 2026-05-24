import { spawnSync } from 'node:child_process';

export interface WinForegroundProbeRuntime {
  runCommand: (command: string, args: string[]) => { status: number | null; stdout: string };
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
  childrenMap: Map<number, { pid: number; name: string }[]>;
  timestamp: number;
} | null = null;

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

const getProcessChildrenMap = (
  runtime: WinForegroundProbeRuntime,
): Map<number, { pid: number; name: string }[]> | null => {
  const now = Date.now();

  // Return cached result if still fresh
  if (cachedProcessTree && now - cachedProcessTree.timestamp < CACHE_TTL_MS) {
    return cachedProcessTree.childrenMap;
  }

  // Query all processes in one call. Using a PowerShell one-liner that outputs
  // "PID,ParentPID,Name" lines for efficient parsing.
  const result = runtime.runCommand('powershell.exe', [
    '-NoProfile',
    '-NoLogo',
    '-Command',
    'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId),$($_.ParentProcessId),$($_.Name)" }',
  ]);

  if (result.status !== 0) {
    return null;
  }

  // Build a parent → children map
  const childrenMap = new Map<number, { pid: number; name: string }[]>();
  const lines = result.stdout.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }

    // Format: "PID,ParentPID,Name"
    const firstComma = trimmed.indexOf(',');
    const secondComma = trimmed.indexOf(',', firstComma + 1);
    if (firstComma === -1 || secondComma === -1) {
      continue;
    }

    const pid = parseInt(trimmed.slice(0, firstComma), 10);
    const parentPid = parseInt(trimmed.slice(firstComma + 1, secondComma), 10);
    const name = trimmed.slice(secondComma + 1).trim();

    if (isNaN(pid) || isNaN(parentPid) || name.length === 0) {
      continue;
    }

    if (IGNORED_PROCESSES.has(name.toLowerCase())) {
      continue;
    }

    if (!childrenMap.has(parentPid)) {
      childrenMap.set(parentPid, []);
    }
    childrenMap.get(parentPid)!.push({ pid, name });
  }

  cachedProcessTree = { childrenMap, timestamp: now };
  return childrenMap;
};

/**
 * Walk down the process tree from a given PID, always preferring the last child
 * (most recently created). Returns the name of the deepest leaf process, or
 * undefined if no children exist.
 */
const findDeepestChild = (
  startPid: number,
  childrenMap: Map<number, { pid: number; name: string }[]>,
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

  // Take the last child (most recently spawned is typically the foreground process)
  const lastChild = children[children.length - 1];

  // Try to go deeper
  const deeper = findDeepestChild(lastChild.pid, childrenMap, visited);
  return deeper ?? stripExeExtension(lastChild.name);
};

const stripExeExtension = (name: string): string => {
  return name.replace(/\.exe$/i, '');
};

/** @internal Reset the process tree cache. Exposed for testing only. */
export const _resetCache = (): void => {
  cachedProcessTree = null;
};
