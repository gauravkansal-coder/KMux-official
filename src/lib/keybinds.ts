/**
 * KMux Keybinds — Single source of truth
 *
 * Every keyboard shortcut in the application is defined here.
 * Both the keyboard handler (useKeyboardNav) and the help overlay
 * (ControlsOverlay) consume these definitions, so a change in one
 * place automatically propagates everywhere.
 */

/* ── Action Identifiers ───────────────────────────────────────────── */

export type KeyAction =
  | 'moveTerminalLeft'
  | 'moveTerminalRight'
  | 'moveWorkspaceUp'
  | 'moveWorkspaceDown'
  | 'jumpToWorkspace'
  | 'addTerminal'
  | 'openTerminalPicker'
  | 'removeTerminal'
  | 'addWorkspace'
  | 'openWorkspacePicker'
  | 'toggleFullscreen'
  | 'cycleWidth'
  | 'resizeShrink'
  | 'resizeExpand'
  | 'fontSizeIncrease'
  | 'fontSizeDecrease'
  | 'globalFontSizeIncrease'
  | 'globalFontSizeDecrease'
  | 'toggleOverview'
  | 'toggleSearch'
  | 'cycleThemes'
  | 'toggleControls';

/* ── Handler Definition ───────────────────────────────────────────── */

export interface KeyBind {
  action: KeyAction;
  /** Require Alt (or Meta on macOS) */
  alt?: boolean;
  /** Require Ctrl */
  ctrl?: boolean;
  /** Require Shift */
  shift?: boolean;
  /** Specific key values (lowercase) — matched with OR logic */
  keys?: string[];
  /** Regex for dynamic key matching (e.g. digit ranges) */
  keyPattern?: RegExp;
}

/* ── Display Definition ───────────────────────────────────────────── */

export interface KeyBindDisplay {
  label: string;
  shortcut: string;
}

export interface KeyBindSection {
  title: string;
  bindings: KeyBindDisplay[];
}

/* ── Keybind Definitions ──────────────────────────────────────────── *
 * ORDER MATTERS: more-specific bindings (extra modifiers) must come  *
 * before less-specific ones so `findKeybind` returns the right match.*
 * ─────────────────────────────────────────────────────────────────── */

export const KEYBINDS: KeyBind[] = [
  // ── Ctrl + Shift (most specific ctrl combos) ──
  { action: 'globalFontSizeIncrease', ctrl: true, shift: true, keys: ['+', '='] },
  { action: 'globalFontSizeDecrease', ctrl: true, shift: true, keys: ['-', '_'] },

  // ── Ctrl only ──
  { action: 'fontSizeIncrease', ctrl: true, keys: ['+', '='] },
  { action: 'fontSizeDecrease', ctrl: true, keys: ['-', '_'] },

  // ── Alt + Shift (most specific alt combos) ──
  { action: 'openTerminalPicker', alt: true, shift: true, keys: ['enter'] },
  { action: 'openWorkspacePicker', alt: true, shift: true, keys: ['n'] },
  { action: 'toggleControls', alt: true, shift: true, keys: ['?'] },

  // ── Alt only ──
  { action: 'toggleFullscreen', alt: true, keys: ['b'] },
  { action: 'jumpToWorkspace', alt: true, keyPattern: /^[1-9]$/ },
  { action: 'moveTerminalLeft', alt: true, keys: ['arrowleft', 'h'] },
  { action: 'moveTerminalRight', alt: true, keys: ['arrowright', 'l'] },
  { action: 'moveWorkspaceUp', alt: true, keys: ['arrowup', 'k'] },
  { action: 'moveWorkspaceDown', alt: true, keys: ['arrowdown', 'j'] },
  { action: 'addTerminal', alt: true, keys: ['enter'] },
  { action: 'addWorkspace', alt: true, keys: ['n'] },
  { action: 'removeTerminal', alt: true, keys: ['w', 'q', 'x'] },
  { action: 'toggleOverview', alt: true, keys: ['o'] },
  { action: 'cycleThemes', alt: true, keys: ['t'] },
  { action: 'toggleSearch', alt: true, keys: ['f'] },
  { action: 'cycleWidth', alt: true, keys: ['r'] },
  { action: 'resizeShrink', alt: true, keys: ['-'] },
  { action: 'resizeExpand', alt: true, keys: ['=', '+'] },
];

/* ── Display Sections (ControlsOverlay) ───────────────────────────── */

export const KEYBIND_SECTIONS: KeyBindSection[] = [
  {
    title: 'Navigation',
    bindings: [
      { label: 'Focus terminal', shortcut: 'Alt + ← →' },
      { label: 'Switch workspace', shortcut: 'Alt + J/K' },
      { label: 'Jump to workspace', shortcut: 'Alt + 1-9' },
    ],
  },
  {
    title: 'Terminals',
    bindings: [
      { label: 'New terminal', shortcut: 'Alt + Enter' },
      { label: 'Choose profile', shortcut: 'Alt + Shift + Enter' },
      { label: 'Close terminal', shortcut: 'Alt + Q/W' },
      { label: 'Toggle fullscreen', shortcut: 'Alt + B' },
    ],
  },
  {
    title: 'Layout',
    bindings: [
      { label: 'Cycle width', shortcut: 'Alt + R' },
      { label: 'Resize', shortcut: 'Alt + -/=' },
      { label: 'Font size', shortcut: 'Ctrl + -/=' },
    ],
  },
  {
    title: 'Utilities',
    bindings: [
      { label: 'Overview', shortcut: 'Alt + O' },
      { label: 'Fuzzy finder', shortcut: 'Alt + F' },
      { label: 'Cycle themes', shortcut: 'Alt + T' },
      { label: 'Toggle help', shortcut: 'Alt + ?' },
    ],
  },
];

/* ── Matcher ──────────────────────────────────────────────────────── */

/**
 * Test whether a KeyboardEvent matches a single KeyBind definition.
 */
export function matchKeybind(e: KeyboardEvent, bind: KeyBind): boolean {
  const key = e.key.toLowerCase();
  const altOrMeta = e.altKey || e.metaKey;

  // ── Ctrl-family binds (ctrl required, no alt) ──
  if (bind.ctrl && !bind.alt) {
    if (!e.ctrlKey) return false;
    if (altOrMeta) return false;
    // Strict shift matching for ctrl binds
    if (bind.shift && !e.shiftKey) return false;
    if (!bind.shift && e.shiftKey) return false;
  }
  // ── Alt-family binds (alt required, no ctrl) ──
  else if (bind.alt && !bind.ctrl) {
    if (!altOrMeta) return false;
    if (e.ctrlKey) return false;
    // Only enforce shift when explicitly required;
    // non-shift alt binds still fire when shift is held
    // (e.g. Alt+Shift+B still triggers toggleFullscreen).
    // Disambiguation is handled by ordering — shift-required
    // binds come first and are matched before non-shift ones.
    if (bind.shift && !e.shiftKey) return false;
  }
  // ── No applicable modifier family ──
  else {
    return false;
  }

  // ── Key match ──
  if (bind.keys?.includes(key)) return true;
  if (bind.keyPattern?.test(key)) return true;

  return false;
}

/**
 * Find the first matching keybind for a KeyboardEvent.
 * Returns the matched `KeyBind` or `undefined`.
 */
export function findKeybind(e: KeyboardEvent): KeyBind | undefined {
  return KEYBINDS.find((bind) => matchKeybind(e, bind));
}
