import { EventEmitter } from 'node:events';
import os from 'node:os';
import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import { Osc7CwdParser, toTerminalCurrentCwd } from './cwd/osc7';
import { probeProcessCwd } from './cwd/probe';
import type { TerminalProfile } from '../shared/terminal-profiles';
import type {
  CreateTerminalRequest,
  KillTerminalRequest,
  ResizeTerminalRequest,
  TerminalCurrentCwd,
  TerminalErrorEvent,
  TerminalExitEvent,
  TerminalOutputEvent,
  TerminalSessionSnapshot,
  TerminalStateEvent,
  WriteTerminalRequest,
} from '../shared/terminal-types';
import { listTerminalProfiles, resolveShell } from './shell/resolveShell';
import { buildPtyEnv } from './utils/env';

const TERMINAL_EVENT_NAMES = {
  output: 'output',
  exit: 'exit',
  state: 'state',
  error: 'error',
} as const;

const MIN_DIMENSION = 2;
const LINUX_CWD_POLL_INTERVAL_MS = 1500;
const DARWIN_CWD_POLL_INTERVAL_MS = 15000;
const FOREGROUND_PROCESS_REFRESH_INTERVAL_MS = 500;

interface TerminalSessionRecord {
  pty: IPty;
  snapshot: TerminalSessionSnapshot;
  cwdParser: Osc7CwdParser;
  cwdProbeTimer?: NodeJS.Timeout;
  osc7Source: 'osc7' | 'shell-hook';
}

const normalizeDimension = (value: number): number => {
  return Math.max(MIN_DIMENSION, Math.floor(value));
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const getForegroundProcess = (ptyProcess: IPty): string | undefined => {
  const processName = ptyProcess.process?.trim();
  return processName && processName.length > 0 ? processName : undefined;
};

const normalizeTrackedPath = (value: string): string => {
  return value.replace(/[\\/]+$/, '').replace(/\\/g, '/').toLowerCase();
};

const isSameCwd = (
  previous: TerminalCurrentCwd | undefined,
  next: TerminalCurrentCwd,
): boolean => {
  return (
    previous?.host === next.host &&
    normalizeTrackedPath(previous?.path ?? '') === normalizeTrackedPath(next.path)
  );
};

const isOsProbeSource = (source: TerminalCurrentCwd['source']): boolean => {
  return source === 'procfs' || source === 'lsof';
};

const canApplyCwdUpdate = (
  previous: TerminalCurrentCwd | undefined,
  next: TerminalCurrentCwd,
): boolean => {
  if (!previous) {
    return true;
  }

  if (isSameCwd(previous, next)) {
    return false;
  }

  if (
    isOsProbeSource(next.source) &&
    (previous.source === 'osc7' || previous.source === 'shell-hook')
  ) {
    return false;
  }

  return true;
};

export class TerminalManager {
  private readonly sessions = new Map<string, TerminalSessionRecord>();
  private readonly events = new EventEmitter();
  private readonly foregroundRefreshTimers = new Map<string, NodeJS.Timeout>();

  public createTerminal(request: CreateTerminalRequest): TerminalSessionSnapshot {
    const existing = this.sessions.get(request.terminalId);
    if (existing) {
      return { ...existing.snapshot };
    }

    const shell = resolveShell(process.platform, process.env, request.profileId);
    const cols = normalizeDimension(request.cols);
    const rows = normalizeDimension(request.rows);
    const cwd = request.cwd ?? os.homedir();
    const env = {
      ...buildPtyEnv(process.env),
      ...(shell.env ?? {}),
    };

    let ptyProcess: IPty;
    try {
      ptyProcess = pty.spawn(shell.command, shell.args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env,
        useConpty: process.platform === 'win32',
      });
    } catch (error) {
      const message = getErrorMessage(error);
      this.events.emit(TERMINAL_EVENT_NAMES.error, {
        terminalId: request.terminalId,
        message,
      } satisfies TerminalErrorEvent);
      throw new Error(`Failed to spawn terminal "${request.terminalId}": ${message}`);
    }

    const snapshot: TerminalSessionSnapshot = {
      terminalId: request.terminalId,
      pid: ptyProcess.pid,
      profileId: request.profileId,
      shell: shell.label,
      foregroundProcess: getForegroundProcess(ptyProcess),
      cwd,
      currentCwd: {
        path: cwd,
        isLocal: true,
        source: 'initial',
        updatedAt: Date.now(),
      },
      cols,
      rows,
      status: 'running',
    };

    const record: TerminalSessionRecord = {
      pty: ptyProcess,
      snapshot,
      cwdParser: new Osc7CwdParser(),
      osc7Source: shell.cwdSignalSource ?? 'osc7',
    };
    this.sessions.set(request.terminalId, record);
    this.startCwdProbe(request.terminalId);

    ptyProcess.onData((data) => {
      this.scheduleForegroundProcessRefresh(request.terminalId);
      this.refreshCwdFromOutput(request.terminalId, data);
      this.events.emit(TERMINAL_EVENT_NAMES.output, {
        terminalId: request.terminalId,
        data,
      } satisfies TerminalOutputEvent);
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      const exitedSession = this.sessions.get(request.terminalId);
      if (exitedSession?.cwdProbeTimer) {
        clearInterval(exitedSession.cwdProbeTimer);
      }
      this.clearForegroundProcessRefresh(request.terminalId);
      this.sessions.delete(request.terminalId);

      this.events.emit(TERMINAL_EVENT_NAMES.exit, {
        terminalId: request.terminalId,
        exitCode,
        signal,
      } satisfies TerminalExitEvent);

      this.emitState({
        ...(exitedSession?.snapshot ?? snapshot),
        status: 'exited',
        exitCode,
        signal,
      });
    });

    this.emitState(snapshot);
    return { ...snapshot };
  }

  public writeTerminal(request: WriteTerminalRequest): void {
    const session = this.sessions.get(request.terminalId);
    if (!session) {
      throw new Error(`Terminal "${request.terminalId}" is not running.`);
    }
    session.pty.write(request.data);
  }

  public resizeTerminal(request: ResizeTerminalRequest): void {
    const session = this.sessions.get(request.terminalId);
    if (!session) {
      throw new Error(`Terminal "${request.terminalId}" is not running.`);
    }

    const cols = normalizeDimension(request.cols);
    const rows = normalizeDimension(request.rows);
    session.pty.resize(cols, rows);

    session.snapshot = {
      ...session.snapshot,
      cols,
      rows,
    };
    this.emitState(session.snapshot);
  }

  public killTerminal(request: KillTerminalRequest): void {
    const session = this.sessions.get(request.terminalId);
    if (!session) {
      return;
    }
    this.clearForegroundProcessRefresh(request.terminalId);
    session.pty.kill();
  }

  public killAll(): void {
    for (const session of this.sessions.values()) {
      if (session.cwdProbeTimer) {
        clearInterval(session.cwdProbeTimer);
      }
      session.pty.kill();
    }
    this.sessions.clear();
    for (const timer of this.foregroundRefreshTimers.values()) {
      clearTimeout(timer);
    }
    this.foregroundRefreshTimers.clear();
  }

  public listTerminals(): TerminalSessionSnapshot[] {
    for (const terminalId of this.sessions.keys()) {
      this.refreshForegroundProcess(terminalId);
    }
    return [...this.sessions.values()].map((session) => ({ ...session.snapshot }));
  }

  public listProfiles(): TerminalProfile[] {
    return listTerminalProfiles(process.platform);
  }

  public onOutput(listener: (event: TerminalOutputEvent) => void): () => void {
    this.events.on(TERMINAL_EVENT_NAMES.output, listener);
    return () => this.events.off(TERMINAL_EVENT_NAMES.output, listener);
  }

  public onExit(listener: (event: TerminalExitEvent) => void): () => void {
    this.events.on(TERMINAL_EVENT_NAMES.exit, listener);
    return () => this.events.off(TERMINAL_EVENT_NAMES.exit, listener);
  }

  public onState(listener: (event: TerminalStateEvent) => void): () => void {
    this.events.on(TERMINAL_EVENT_NAMES.state, listener);
    return () => this.events.off(TERMINAL_EVENT_NAMES.state, listener);
  }

  public onError(listener: (event: TerminalErrorEvent) => void): () => void {
    this.events.on(TERMINAL_EVENT_NAMES.error, listener);
    return () => this.events.off(TERMINAL_EVENT_NAMES.error, listener);
  }

  private emitState(snapshot: TerminalSessionSnapshot): void {
    this.events.emit(TERMINAL_EVENT_NAMES.state, {
      terminalId: snapshot.terminalId,
      snapshot: { ...snapshot },
    } satisfies TerminalStateEvent);
  }

  private refreshForegroundProcess(terminalId: string): void {
    const session = this.sessions.get(terminalId);
    if (!session) {
      return;
    }

    const foregroundProcess = getForegroundProcess(session.pty);
    if (foregroundProcess === session.snapshot.foregroundProcess) {
      return;
    }

    session.snapshot = {
      ...session.snapshot,
      foregroundProcess,
    };
    this.emitState(session.snapshot);
  }

  private scheduleForegroundProcessRefresh(terminalId: string): void {
    if (this.foregroundRefreshTimers.has(terminalId)) {
      return;
    }

    const timer = setTimeout(() => {
      this.foregroundRefreshTimers.delete(terminalId);
      this.refreshForegroundProcess(terminalId);
    }, FOREGROUND_PROCESS_REFRESH_INTERVAL_MS);
    this.foregroundRefreshTimers.set(terminalId, timer);
  }

  private clearForegroundProcessRefresh(terminalId: string): void {
    const timer = this.foregroundRefreshTimers.get(terminalId);
    if (timer) {
      clearTimeout(timer);
      this.foregroundRefreshTimers.delete(terminalId);
    }
  }

  private startCwdProbe(terminalId: string): void {
    const session = this.sessions.get(terminalId);
    if (!session) {
      return;
    }

    const interval =
      process.platform === 'linux'
        ? LINUX_CWD_POLL_INTERVAL_MS
        : process.platform === 'darwin'
          ? DARWIN_CWD_POLL_INTERVAL_MS
          : 0;

    if (interval === 0) {
      return;
    }

    this.refreshCwdFromProcess(terminalId);
    session.cwdProbeTimer = setInterval(() => {
      this.refreshCwdFromProcess(terminalId);
    }, interval);
  }

  private refreshCwdFromProcess(terminalId: string): void {
    const session = this.sessions.get(terminalId);
    if (!session) {
      return;
    }

    const currentCwd = probeProcessCwd(process.platform, session.pty.pid);
    if (!currentCwd) {
      return;
    }

    this.updateCurrentCwd(terminalId, currentCwd);
  }

  private refreshCwdFromOutput(terminalId: string, data: string): void {
    const session = this.sessions.get(terminalId);
    if (!session) {
      return;
    }

    for (const parsedCwd of session.cwdParser.push(data)) {
      this.updateCurrentCwd(
        terminalId,
        toTerminalCurrentCwd(parsedCwd, session.osc7Source),
      );
    }
  }

  private updateCurrentCwd(terminalId: string, currentCwd: TerminalCurrentCwd): void {
    const session = this.sessions.get(terminalId);
    if (!session || !canApplyCwdUpdate(session.snapshot.currentCwd, currentCwd)) {
      return;
    }

    session.snapshot = {
      ...session.snapshot,
      currentCwd,
    };
    this.emitState(session.snapshot);
  }
}
