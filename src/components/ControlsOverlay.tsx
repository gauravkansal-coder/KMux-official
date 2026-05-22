import React, { useEffect, useRef, useState } from "react";
import { useCanvasStore } from "../store/useCanvasStore";
import { Z_LAYERS } from "../lib/constants";
import { KEYBIND_SECTIONS, type KeyBindDisplay, type KeyBindSection } from "../lib/keybinds";

/* ── Data ─────────────────────────────────────────────────────────── */

const OVERLAY_TITLE_ID = "controls-overlay-title";

/* ── Inject keyframes once ────────────────────────────────────────── */

const STYLE_ID = "controls-overlay-keyframes";

function ensureKeyframes() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes controls-backdrop-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes controls-backdrop-out {
      from { opacity: 1; }
      to   { opacity: 0; }
    }
    @keyframes controls-panel-in {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.97);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    @keyframes controls-panel-out {
      from {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      to {
        opacity: 0;
        transform: translateY(8px) scale(0.98);
      }
    }
    @keyframes controls-row-in {
      from {
        opacity: 0;
        transform: translateX(-6px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
  `;
  document.head.appendChild(style);
}

/* ── Constants ────────────────────────────────────────────────────── */

const FONT = "'JetBrains Mono', monospace";
const ANIM_DURATION = 200; // ms

/* ── Sub-components ───────────────────────────────────────────────── */

const BindingRow: React.FC<{
  binding: KeyBindDisplay;
  textColor: string;
  textDim: string;
  delay: number;
  animate: boolean;
}> = ({ binding, textColor, textDim, delay, animate }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "5px 0",
      animation: animate
        ? `controls-row-in 250ms ${delay}ms cubic-bezier(0.25, 1, 0.5, 1) both`
        : "none",
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
  baseDelay: number;
  animate: boolean;
}> = ({ section, textColor, textDim, sectionLabelColor, baseDelay, animate }) => (
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
        animation: animate
          ? `controls-row-in 250ms ${baseDelay}ms cubic-bezier(0.25, 1, 0.5, 1) both`
          : "none",
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
      {section.bindings.map((b, i) => (
        <BindingRow
          key={b.label}
          binding={b}
          textColor={textColor}
          textDim={textDim}
          delay={baseDelay + (i + 1) * 30}
          animate={animate}
        />
      ))}
    </div>
  </div>
);

/* ── Main Overlay ─────────────────────────────────────────────────── */

export const ControlsOverlay: React.FC = () => {
  const { isControlsOpen, toggleControls, theme } = useCanvasStore();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [animateRows, setAnimateRows] = useState(false);
  const [isCloseHovered, setIsCloseHovered] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Inject keyframes stylesheet
  useEffect(() => {
    ensureKeyframes();
  }, []);

  // Manage open/close states with animation
  useEffect(() => {
    if (isControlsOpen) {
      setVisible(true);
      setClosing(false);
      requestAnimationFrame(() => setAnimateRows(true));
    } else if (visible) {
      setClosing(true);
      setAnimateRows(false);
      const timer = setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, ANIM_DURATION);
      return () => clearTimeout(timer);
    }
  }, [isControlsOpen, visible]);

  // Move focus into the dialog while open, then restore it after close.
  useEffect(() => {
    if (!isControlsOpen || !visible) return;

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    panelRef.current?.focus();

    return () => {
      previouslyFocusedRef.current?.focus();
      previouslyFocusedRef.current = null;
    };
  }, [isControlsOpen, visible]);

  // ESC to close
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        toggleControls();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [visible, toggleControls]);

  if (!visible) return null;

  const animState = closing ? "out" : "in";

  // Compute stagger delays for each section sequentially
  let runningDelay = 0;
  const sectionDelays: number[] = [];
  KEYBIND_SECTIONS.forEach((s) => {
    sectionDelays.push(runningDelay);
    runningDelay += (s.bindings.length + 1) * 30 + 50;
  });

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
        animation: `controls-backdrop-${animState} ${ANIM_DURATION}ms ease both`,
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
          animation: `controls-panel-${animState} ${ANIM_DURATION}ms cubic-bezier(0.16, 1, 0.3, 1) both`,
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
          {KEYBIND_SECTIONS.map((s, i) => (
            <SectionBlock
              key={s.title}
              section={s}
              textColor={theme.text}
              textDim={theme.textDim}
              sectionLabelColor={sectionLabelColor}
              baseDelay={sectionDelays[i]}
              animate={animateRows}
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
