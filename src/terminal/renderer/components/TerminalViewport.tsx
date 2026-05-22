import React, { useEffect, useRef, useState } from 'react';
import type { Terminal as XtermTerminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import { useCanvasStore } from '../../../store/useCanvasStore';
import type { TerminalSessionSnapshot } from '../../shared/terminal-types';
import { useTerminalRuntime } from '../context/useTerminalRuntime';
import { fitTerminal, observeTerminalSize } from '../utils/terminalSizing';
import { createXterm } from '../xterm/createXterm';
import { toXtermTheme } from '../xterm/terminalTheme';

interface Props {
  terminalId: string;
  isActive: boolean;
}

const getStatusLabel = (session: TerminalSessionSnapshot | undefined): string => {
  if (!session) return 'starting...';
  if (session.status === 'running') return session.shell || 'running';
  if (session.status === 'exited') return `exited (${session.exitCode ?? 0})`;
  if (session.status === 'error') return session.errorMessage ?? 'failed to start';
  return 'starting...';
};

export const TerminalViewport: React.FC<Props> = ({ terminalId, isActive }) => {
  const theme = useCanvasStore((state) => state.theme);
  const terminalFontSize = useCanvasStore(
    (state) => state.terminalFontSizes[terminalId] ?? state.terminalFontSize,
  );
  const { sessions, registerOutputSink, writeTerminal, resizeTerminal } = useTerminalRuntime();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<XtermTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const initialTerminalFontSizeRef = useRef(terminalFontSize);
  const bootstrappedRef = useRef(false);
  const hideScrollbarTimerRef = useRef<number | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);

  const session = sessions[terminalId];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const { terminal, fitAddon } = createXterm(
      toXtermTheme(theme),
      initialTerminalFontSizeRef.current,
    );
    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;
    terminal.open(container);
    const viewport = container.querySelector('.xterm-viewport');

    const detachOutput = registerOutputSink(terminalId, (chunk) => {
      terminal.write(chunk);
    });

    const inputDisposable = terminal.onData((input) => {
      void writeTerminal(terminalId, input).catch((error) => {
        console.error(`Failed to write input for terminal "${terminalId}".`, error);
      });
    });

    const stopObserving = observeTerminalSize(container, terminal, fitAddon, ({ cols, rows }) => {
      void resizeTerminal(terminalId, cols, rows).catch((error) => {
        console.error(`Failed to resize terminal "${terminalId}".`, error);
      });
    });

    const onViewportActivity = (): void => {
      setIsScrolling(true);
      if (hideScrollbarTimerRef.current !== null) {
        window.clearTimeout(hideScrollbarTimerRef.current);
      }
      hideScrollbarTimerRef.current = window.setTimeout(() => {
        setIsScrolling(false);
        hideScrollbarTimerRef.current = null;
      }, 700);
    };

    if (viewport instanceof HTMLElement) {
      viewport.addEventListener('wheel', onViewportActivity, { passive: true });
      viewport.addEventListener('scroll', onViewportActivity, { passive: true });
    }

    return () => {
      if (viewport instanceof HTMLElement) {
        viewport.removeEventListener('wheel', onViewportActivity);
        viewport.removeEventListener('scroll', onViewportActivity);
      }
      if (hideScrollbarTimerRef.current !== null) {
        window.clearTimeout(hideScrollbarTimerRef.current);
        hideScrollbarTimerRef.current = null;
      }
      stopObserving();
      inputDisposable.dispose();
      detachOutput();
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [registerOutputSink, resizeTerminal, terminalId, writeTerminal]);

  useEffect(() => {
    if (!xtermRef.current) {
      return;
    }
    xtermRef.current.options.theme = toXtermTheme(theme);
  }, [theme]);

  useEffect(() => {
    const terminal = xtermRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon) {
      return;
    }

    terminal.options.fontSize = terminalFontSize;
    const frameId = window.requestAnimationFrame(() => {
      const { cols, rows } = fitTerminal(terminal, fitAddon);
      void resizeTerminal(terminalId, cols, rows).catch((error) => {
        console.error(`Failed to resize terminal "${terminalId}" after font size change.`, error);
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [resizeTerminal, terminalFontSize, terminalId]);

  useEffect(() => {
    if (isActive) {
      xtermRef.current?.focus();
    }
  }, [isActive]);

  useEffect(() => {
    if (!xtermRef.current || !session) {
      return;
    }
    if (bootstrappedRef.current) {
      return;
    }

    if (session.status === 'running') {
      bootstrappedRef.current = true;
      xtermRef.current.write(`\u001b[2m[${session.shell}] terminal ready\u001b[0m\r\n`);
    }
  }, [session]);

  return (
    <div className={`w-full h-full relative terminal-viewport-shell ${isScrolling ? 'is-scrolling' : ''}`}>
      <div ref={containerRef} className="w-full h-full px-2 py-1.5" />
      <div
        className="absolute right-2 bottom-1.5 rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider pointer-events-none"
        style={{
          color: theme.textDim,
          background: 'rgba(0,0,0,0.2)',
        }}
      >
        {getStatusLabel(session)}
      </div>
    </div>
  );
};
