import React, { useState, useEffect, useRef } from "react";
import { useCanvasStore } from "../store/useCanvasStore";
import {
  formatCwdHint,
  getPathBasename,
  getTerminalSearchText,
} from "../terminal/shared/cwd-format";
import { useTerminalRuntime } from "../terminal/renderer/context/useTerminalRuntime";
import { fuzzyIncludes } from "../lib/fuzzySearch";

/** PTY terminal identifiers that should never be displayed as process labels. */
const PTY_TERMINAL_NAMES = new Set([
  'xterm-256color',
  'xterm-color',
  'xterm',
  'screen-256color',
  'screen',
  'Windows Shell',
]);

const getTerminalLabel = (
  session: ReturnType<typeof useTerminalRuntime>["sessions"][string] | undefined,
  fallback: string,
): string => {
  const foregroundProcess = session?.foregroundProcess?.trim();
  const shell = session?.shell?.trim();
  if (
    foregroundProcess &&
    !PTY_TERMINAL_NAMES.has(foregroundProcess) &&
    getPathBasename(foregroundProcess) !== shell
  ) {
    return foregroundProcess;
  }

  const cwdHint = formatCwdHint(session?.currentCwd, session?.cwd);
  return cwdHint?.folder || shell || fallback;
};

export const FuzzyFinder: React.FC = () => {
  const {
    workspaces,
    theme,
    isSearchOpen,
    toggleSearch,
    jumpToGlobalTerminal,
  } = useCanvasStore();
  const { sessions } = useTerminalRuntime();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const allTerminals = workspaces.flatMap((ws, wsIdx) =>
    ws.items
      .filter((item) => item.type === "terminal")
      .map((t) => ({
        ...t,
        workspaceName: `ws ${wsIdx + 1}`,
        wsIdx,
      })),
  );

  const filtered = allTerminals.filter((t) => {
    const session = sessions[t.id];
    const label = getTerminalLabel(session, t.title);
    return fuzzyIncludes(
      getTerminalSearchText(session, t.title, t.workspaceName, label),
      query,
    );
  });

  useEffect(() => {
    if (isSearchOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isSearchOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      e.preventDefault();
    } else if (e.key === "Enter") {
      if (filtered[selectedIndex]) {
        jumpToGlobalTerminal(filtered[selectedIndex].id);
      }
    } else if (e.key === "Escape") {
      toggleSearch();
    }
  };

  if (!isSearchOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center"
      style={{ paddingTop: "10vh" }}
      onClick={toggleSearch}
    >
      <div
        className="w-[480px] overflow-hidden"
        style={{
          background: theme.bg,
          border: `1px solid ${theme.border}`,
          borderRadius: "6px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div
          className="flex items-center gap-2 px-3"
          style={{
            borderBottom: `1px solid ${theme.border}`,
            height: "36px",
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            style={{ color: theme.textDim, flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none"
            placeholder="jump to terminal..."
            style={{
              color: theme.text,
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "12px",
            }}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Results */}
        <div style={{ maxHeight: "320px", overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div
              className="px-3 py-4 text-center"
              style={{
                color: theme.textDim,
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "11px",
              }}
            >
              no results
            </div>
          ) : (
            filtered.map((t, i) => {
              const session = sessions[t.id];
              const label = getTerminalLabel(session, t.title);
              const shell = session?.shell;
              const showShell = shell && shell !== label;
              const cwdHint = formatCwdHint(session?.currentCwd, session?.cwd);
              const cwdPath = cwdHint?.host
                ? `${cwdHint.host}:${cwdHint.shortPath}`
                : cwdHint?.shortPath;

              return (
                <div
                  key={t.id}
                  className="flex items-center gap-2 px-3 cursor-pointer"
                  style={{
                    height: "30px",
                    background:
                      i === selectedIndex ? `${theme.accent}18` : "transparent",
                    outline:
                      i === selectedIndex
                        ? `1px solid ${theme.accent}`
                        : "1px solid transparent",
                    outlineOffset: "-1px",
                  }}
                  onClick={() => jumpToGlobalTerminal(t.id)}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{
                      color: i === selectedIndex ? theme.accent : theme.textDim,
                      flexShrink: 0,
                    }}
                  >
                    <polyline points="4 17 10 11 4 5" />
                    <line x1="12" y1="19" x2="20" y2="19" />
                  </svg>
                  <span
                    style={{
                      color: i === selectedIndex ? theme.text : theme.textDim,
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: "12px",
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </span>
                  {cwdHint ? (
                    <span
                      style={{
                        color: i === selectedIndex ? theme.accent : theme.textDim,
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: "10px",
                        opacity: i === selectedIndex ? 0.9 : 0.62,
                        flexShrink: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={cwdHint.host ? `${cwdHint.host}:${cwdHint.fullPath}` : cwdHint.fullPath}
                    >
                      {cwdHint.folder} · {cwdPath}
                    </span>
                  ) : null}
                  {showShell ? (
                    <span
                      style={{
                        color: theme.textDim,
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: "10px",
                        opacity: 0.45,
                        flexShrink: 0,
                      }}
                    >
                      {shell}
                    </span>
                  ) : null}
                  <span
                    style={{
                      color: theme.textDim,
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: "10px",
                      opacity: 0.5,
                      flexShrink: 0,
                    }}
                  >
                    {t.workspaceName}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
