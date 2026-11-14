import { EditorView } from '@uiw/react-codemirror';
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { kotlin } from '@codemirror/legacy-modes/mode/clike';

// There is no official CodeMirror 6 Kotlin grammar, but @codemirror/legacy-modes
// ships a real, dedicated Kotlin mode (not a Java/C-like fallback) via the
// clike.js module's standalone `kotlin` export - it has Kotlin's own keyword
// set (fun, val, var, when, companion, etc.), confirmed by inspecting the
// mode definition directly before depending on it. (`clike` is a separate,
// unrelated factory function in that same module - not a namespace holding
// `kotlin` as a property.)
export const kotlinLanguage = StreamLanguage.define(kotlin);

// Theme built directly from this app's existing --ik-* design tokens
// (src/index.css) rather than importing a canned theme, so the editor
// reads as part of HDD, not a bolted-on third-party widget.
const colors = {
  bg: '#101216',       // matches the previous textarea's editor background
  surface: '#1a1d22',
  border: '#333333',   // var(--ik-border)
  text: '#f0f0f0',     // var(--ik-text)
  muted: '#888888',    // var(--ik-muted)
  yellow: '#f4e84a',   // var(--ik-yellow)
  cf: '#4a9eff',        // var(--ik-cf)
  green: '#4caf50',    // var(--ik-green)
  red: '#ff4d4d',       // var(--ik-red)
  orange: '#ff6b3d',   // var(--ik-ioi)
  purple: '#9c4aff',   // var(--ik-icpc)
  caret: '#8fb6ff',
  selection: 'rgba(74, 158, 255, 0.25)',
  activeLine: 'rgba(255, 255, 255, 0.04)',
};

export const ikEditorTheme = EditorView.theme(
  {
    '&': {
      color: colors.text,
      backgroundColor: colors.bg,
      height: '100%',
      fontSize: '0.92rem',
    },
    '.cm-content': {
      caretColor: colors.caret,
      fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
      padding: '0.85rem 0',
    },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: colors.caret },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: `${colors.selection} !important`,
    },
    '.cm-activeLine': { backgroundColor: colors.activeLine },
    '.cm-activeLineGutter': { backgroundColor: colors.activeLine },
    '.cm-gutters': {
      backgroundColor: colors.bg,
      color: colors.muted,
      border: 'none',
      borderRight: `1px solid ${colors.border}`,
    },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 0.75rem 0 0.5rem' },
    '.cm-matchingBracket, .cm-nonmatchingBracket': {
      backgroundColor: 'rgba(244, 232, 74, 0.18)',
      outline: `1px solid ${colors.yellow}`,
    },
    '.cm-scroller': { overflow: 'auto' },
    '&.cm-focused': { outline: 'none' },
    '.cm-tooltip': {
      backgroundColor: colors.surface,
      border: `1px solid ${colors.border}`,
      color: colors.text,
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: 'rgba(74, 158, 255, 0.18)',
      color: colors.text,
    },
  },
  { dark: true },
);

export const ikHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: colors.yellow, fontWeight: '600' },
  { tag: [t.controlKeyword, t.operatorKeyword, t.modifier], color: colors.yellow },
  { tag: t.typeName, color: colors.purple },
  { tag: t.className, color: colors.purple },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: colors.cf },
  { tag: t.propertyName, color: colors.cf },
  { tag: t.string, color: colors.green },
  { tag: t.number, color: colors.orange },
  { tag: t.bool, color: colors.orange },
  { tag: [t.lineComment, t.blockComment], color: colors.muted, fontStyle: 'italic' },
  { tag: t.operator, color: colors.text },
  { tag: t.punctuation, color: colors.muted },
  { tag: t.variableName, color: colors.text },
  { tag: t.annotation, color: colors.orange },
]);

export const ikEditorExtensions = [
  kotlinLanguage,
  ikEditorTheme,
  syntaxHighlighting(ikHighlightStyle),
];
