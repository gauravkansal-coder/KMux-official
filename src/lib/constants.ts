import { Theme } from "../types/canvas-types";

/**
 * Spatial Layout Configurations (vw/vh)
 */
export const CAMERA_PADDING = 4;
export const CAMERA_SOLITAIRE_MARGIN = 100;
export const GAPS_VW = 1.25;
export const SCREEN_WIDTH_VW = 100;
export const SCREEN_HEIGHT_VH = 100;

/**
 * Terminal Width Specifications (vw)
 */
export const TERMINAL_WIDTHS = {
  "1/3": 32,
  "1/2": 50,
  "2/3": 67,
  "1": 96,
} as const;

/**
 * Cinematic Motion Constants
 */
export const OVERVIEW_SCALE = 0.3;
export const TRANSITION_CANVAS = "180ms cubic-bezier(0.25, 1, 0.5, 1)";
export const TRANSITION_UI = "180ms ease";
export const UI_HIDE_TIMEOUT = 5000;

/**
 * Z-Index Layer Map
 */
export const Z_LAYERS = {
  CANVAS: 0,
  INDICATORS: 50,
  CONTROLS: 60,
  SEARCH: 100,
};

/**
 * Component-Specific Specs
 */
export const SEARCH_BOX_WIDTH = "640px";
export const SEARCH_BOX_TOP = "15vh";
export const DEFAULT_TERMINAL_FONT_SIZE = 12;
export const MIN_TERMINAL_FONT_SIZE = 9;
export const MAX_TERMINAL_FONT_SIZE = 24;
export const TERMINAL_FONT_SIZE_STEP = 1;

/**
 * Standard Keyboard Cycle Fractions
 */
export const WIDTH_CYCLE: ("1/3" | "1/2" | "2/3" | "1")[] = [
  "1",
  "2/3",
  "1/2",
  "1/3",
];

/**
 * Global Cinematic Theme Definitions
 */
export const THEMES: Record<string, Theme> = {
  standard: {
    name: "Standard",
    bg: "#050302",
    panelBg: "rgba(22, 16, 13, 0.94)",
    accent: "#ff6e3c",
    text: "#e8dcc8",
    textDim: "rgba(232,220,200,0.3)",
    border: "rgba(232,220,200,0.08)",
  },
  midnight: {
    name: "Midnight Blue",
    bg: "#020617",
    panelBg: "rgba(2,6,23,0.9)",
    accent: "#38bdf8",
    text: "#f8fafc",
    textDim: "rgba(248,250,252,0.4)",
    border: "rgba(248,250,252,0.1)",
  },
  dracula: {
    name: "Dracula",
    bg: "#282a36",
    panelBg: "rgba(40,42,54,0.92)",
    accent: "#bd93f9",
    text: "#f8f8f2",
    textDim: "rgba(248,248,242,0.4)",
    border: "rgba(248,248,242,0.1)",
  },
  monochrome: {
    name: "Monochrome",
    bg: "#050505",
    panelBg: "rgba(12,12,12,0.96)",
    accent: "#f2f2f2",
    text: "#f2f2f2",
    textDim: "rgba(242,242,242,0.42)",
    border: "rgba(242,242,242,0.14)",
  },
};
