/** GroupSave — Shared dark design tokens — imported by all screens & components */
export const D = {
  // ── Backgrounds ──────────────────────────────────────────────────────────────
  bg: '#1a1a1a',               // Root screen background
  surface: 'rgba(255,255,255,0.06)',// List items, section containers
  surfaceHi: '#242424',              // Elevated card / modal
  surfaceCard: '#242424',            // Card background
  surfaceInput: 'rgba(255,255,255,0.06)',// Text input background

  // ── Accent (primary brand) ────────────────────────────────────────────────────
  accent: '#6eb5ff',              // Light blue — primary accent
  accentSoft: 'rgba(110,181,255,0.15)',// Subtle fills, badge tints
  accentMed: 'rgba(110,181,255,0.25)',// Step circles, focused borders
  accentGlow: 'rgba(110,181,255,0.18)',// Button glow, shadow
  accentGrad: ['#00d68f', '#00bb7a'] as const, // Progress bar, primary btn gradient

  // ── Brand greens (primary action) ────────────────────────────────────────────
  primary: '#00d68f',              // Primary green — main CTA
  primaryMid: '#00bb7a',           // Green mid — hover / pressed states
  blueMid: '#6eb5ff',              // Light blue — secondary elements, links
  accentLight: '#4a9eff',          // Bright blue — chips, tag backgrounds

  // ── Backward-compat aliases ────────────────────────────────────────────────────
  /** @deprecated use D.primary */
  accent2: '#00d68f',
  /** @deprecated use D.success */
  accent2Soft: 'rgba(0,214,143,0.15)',
  /** @deprecated use D.surfaceCard */
  purple: '#242424',
  /** @deprecated use D.accentSoft */
  purpleSoft: 'rgba(110,181,255,0.15)',

  // ── Status ───────────────────────────────────────────────────────────────────
  success: '#00d68f',
  successGrad: ['#00d68f', '#00bb7a'] as const,

  warn: '#f59e0b',
  warnSoft: 'rgba(245,158,11,0.15)',
  warning: '#f59e0b',

  danger: '#ef4444',
  dangerSoft: 'rgba(239,68,68,0.15)',

  // ── Text ──────────────────────────────────────────────────────────────────────
  text: '#ffffff',                   // Primary text
  textPrimary: '#ffffff',
  textSub: 'rgba(255,255,255,0.5)',    // Subtitles, supporting text
  textSecondary: 'rgba(255,255,255,0.5)',
  textMuted: 'rgba(255,255,255,0.3)',    // Disabled, timestamps
  textPlaceholder: 'rgba(255,255,255,0.35)',    // Input placeholders

  // ── Borders ───────────────────────────────────────────────────────────────────
  border: 'rgba(255,255,255,0.08)',
  borderHi: 'rgba(255,255,255,0.15)',
  borderFocus: 'rgba(110,181,255,0.50)',
  borderAccent: 'rgba(110,181,255,0.45)',

  // ── Toggle ────────────────────────────────────────────────────────────────────
  toggleBg: 'rgba(255,255,255,0.08)',

  // ── Gradients ─────────────────────────────────────────────────────────────────
  gradientHeader: ['#1a1a1a', '#242424'] as const,
  gradientAccent: ['#00d68f', '#6eb5ff'] as const,
  gradientSuccess: ['#00d68f', '#00bb7a'] as const,

  // ── Overlay / scrim ───────────────────────────────────────────────────────────
  overlay: 'rgba(0,0,0,0.75)',

  // ── Radius ────────────────────────────────────────────────────────────────────
  radius: 16,
  radiusSm: 10,
  radiusLg: 24,

  // ── Shadow (android elevation + iOS params) ───────────────────────────────────
  shadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;
