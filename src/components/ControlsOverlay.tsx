import React, { useEffect, useRef, useState } from "react";
import { useCanvasStore } from "../store/useCanvasStore";
import { Z_LAYERS } from "../lib/constants";
import { KEYBIND_SECTIONS, type KeyBindDisplay, type KeyBindSection } from "../lib/keybinds";

/* ── Data ─────────────────────────────────────────────────────────── */

const OVERLAY_TITLE_ID = "controls-overlay-title";

/* ── Constants ────────────────────────────────────────────────────── */

const FONT = "'JetBrains Mono', monospace";

/* ── Sub-components ───────────────────────────────────────────────── */

const BindingRow: React.FC<{
  binding: KeyBindDisplay;
  textColor: string;
  textDim: string;
}> = ({ binding, textColor, textDim }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "5px 0",
    }}
  >
    <span
      style={{
        fontSize: "12px",
        fontWeight: 400,
        color: textColor,
        fontFamily: FONT,
      }}
    >
      {binding.label}
    </span>
    <span
      style={{
        fontSize: "12px",
        fontWeight: 400,
        color: textDim,
        fontFamily: FONT,
        letterSpacing: "0.02em",
      }}
    >
      {binding.shortcut}
    </span>
  </div>
);

const SectionBlock: React.FC<{
  section: KeyBindSection;
  textColor: string;
  textDim: string;
  sectionLabelColor: string;
}> = ({ section, textColor, textDim, sectionLabelColor }) => (
  <div>
    <div
      style={{
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase" as const,
        color: sectionLabelColor,
        marginBottom: "10px",
        fontFamily: FONT,
      }}
    >
      {section.title}
    </div>
    <div
      style={{
        display: "flex",
        flexDirection: "column" as const,
        gap: "0px",
      }}
    >
      {section.bindings.map((b) => (
        <BindingRow
          key={b.label}
          binding={b}
          textColor={textColor}
          textDim={textDim}
        />
      ))}
    </div>
  </div>
);

/* ── Main Overlay ─────────────────────────────────────────────────── */

export const ControlsOverlay: React.FC = () => {
  const { isControlsOpen, toggleControls, theme } = useCanvasStore();
  const [isCloseHovered, setIsCloseHovered] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Move focus into the dialog while open, then restore it after close.
  useEffect(() => {
    if (!isControlsOpen) return;

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    panelRef.current?.focus();

    return () => {
      previouslyFocusedRef.current?.focus();
      previouslyFocusedRef.current = null;
    };
  }, [isControlsOpen]);

  // ESC to close
  useEffect(() => {
    if (!isControlsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        toggleControls();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isControlsOpen, toggleControls]);

  if (!isControlsOpen) return null;

  // Derive a dim section label color from theme.textDim
  const sectionLabelColor = theme.textDim;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z_LAYERS.SEARCH + 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.70)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        padding: "24px",
      }}
      onClick={toggleControls}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={OVERLAY_TITLE_ID}
        tabIndex={-1}
        style={{
          background: theme.panelBg,
          border: `1px solid ${theme.border}`,
          outline: "none",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "520px",
          padding: "24px 32px",
          display: "flex",
          flexDirection: "column" as const,
          gap: "20px",
          fontFamily: FONT,
          boxShadow: `0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px ${theme.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "16px",
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <span
            id={OVERLAY_TITLE_ID}
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase" as const,
              fontFamily: FONT,
              color: theme.accent,
            }}
          >
            KMUX CONTROLS
          </span>
          <button
            onClick={toggleControls}
            aria-label="Close controls"
            style={{
              background: isCloseHovered ? `${theme.accent}18` : "transparent",
              color: isCloseHovered ? theme.text : theme.textDim,
              fontSize: "10px",
              fontWeight: 500,
              fontFamily: FONT,
              padding: "4px 8px",
              borderRadius: "4px",
              border: `1px solid ${isCloseHovered ? `${theme.accent}66` : theme.border}`,
              cursor: "pointer",
              lineHeight: 1,
              transition: "all 150ms ease",
            }}
            onMouseEnter={() => setIsCloseHovered(true)}
            onMouseLeave={() => setIsCloseHovered(false)}
          >
            ESC
          </button>
        </div>

        {/* ── Sections (single column) ────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column" as const,
            gap: "20px",
            padding: "4px 0",
          }}
        >
          {KEYBIND_SECTIONS.map((s) => (
            <SectionBlock
              key={s.title}
              section={s}
              textColor={theme.text}
              textDim={theme.textDim}
              sectionLabelColor={sectionLabelColor}
            />
          ))}
        </div>

        {/* ── Footer ──────────────────────────────────────────── */}
        <div
          style={{
            textAlign: "center" as const,
            fontSize: "10px",
            fontWeight: 400,
            letterSpacing: "0.15em",
            textTransform: "uppercase" as const,
            color: theme.textDim,
            fontFamily: FONT,
            borderTop: `1px solid ${theme.border}`,
            paddingTop: "16px",
          }}
        >
          ALT + ? FOR FULL HELP
        </div>
      </div>
    </div>
  );
};
