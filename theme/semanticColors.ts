/** GroupSave — Semantic colour tokens (used by components that reference contextual roles) */

export const semanticColors = {
    // ── Backgrounds ──────────────────────────────────────────────────────────────
    background: '#1a1a1a',
    backgroundSecondary: '#121212',
    containerBackground: '#242424',
    cardBackground: '#242424',
    inputBackground: 'rgba(255,255,255,0.06)',

    // ── Text ──────────────────────────────────────────────────────────────────────
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.5)',
    textDescription: 'rgba(255,255,255,0.5)',
    textMuted: 'rgba(255,255,255,0.3)',
    textInverse: '#ffffff',

    // ── Buttons ───────────────────────────────────────────────────────────────────
    buttonPrimary: '#00d68f',
    buttonPrimaryHover: '#00bb7a',
    buttonSecondary: '#0a1a0f',
    buttonSecondaryHover: '#0d2015',
    buttonDisabled: 'rgba(0,214,143,0.40)',

    // ── Borders ───────────────────────────────────────────────────────────────────
    border: 'rgba(255,255,255,0.08)',
    borderLight: 'rgba(255,255,255,0.05)',
    borderFocus: 'rgba(110,181,255,0.50)',
    divider: 'rgba(255,255,255,0.08)',

    // ── Status ───────────────────────────────────────────────────────────────────
    success: '#00d68f',
    successLight: 'rgba(0,214,143,0.15)',
    successText: '#00d68f',

    warning: '#f59e0b',
    warningLight: 'rgba(245,158,11,0.15)',
    warningText: '#f59e0b',

    danger: '#ef4444',
    dangerLight: 'rgba(239,68,68,0.15)',
    dangerText: '#ef4444',

    info: '#6eb5ff',
    infoLight: 'rgba(110,181,255,0.15)',
    infoText: '#6eb5ff',

    // ── Gradients ─────────────────────────────────────────────────────────────────
    gradientPrimary: ['#00d68f', '#00bb7a'] as const,
    gradientSecondary: ['#1a1a1a', '#242424'] as const,
    gradientPurple: ['#1a1a1a', '#242424'] as const,   // alias kept for compat — no longer purple
    gradientSuccess: ['#00d68f', '#00bb7a'] as const,
    gradientWarning: ['#f59e0b', '#d97706'] as const,
    gradientDanger: ['#ef4444', '#dc2626'] as const,
    gradientInfo: ['#6eb5ff', '#4a9eff'] as const,
    gradientHeader: ['#1a1a1a', '#242424'] as const,

    // ── Accents ───────────────────────────────────────────────────────────────────
    accent: '#6eb5ff',
    accentLight: 'rgba(110,181,255,0.15)',
    accentMuted: 'rgba(110,181,255,0.45)',

    // ── Progress & Indicators ────────────────────────────────────────────────────
    progressBackground: 'rgba(255,255,255,0.1)',
    progressFill: '#6eb5ff',

    // ── Shadows ───────────────────────────────────────────────────────────────────
    shadowColor: '#000000',

    // ── Icons ─────────────────────────────────────────────────────────────────────
    iconPrimary: '#ffffff',
    iconSecondary: 'rgba(255,255,255,0.7)',
    iconMuted: 'rgba(255,255,255,0.3)',

    // ── Tab Bar ───────────────────────────────────────────────────────────────────
    tabActive: '#00d68f',
    tabInactive: 'rgba(255,255,255,0.4)',
    tabBackground: 'rgba(26,26,26,0.95)',

    // ── Badge Colors ──────────────────────────────────────────────────────────────
    badgePrimary: '#6eb5ff',
    badgeSuccess: '#00d68f',
    badgeWarning: '#f59e0b',
    badgeDanger: '#ef4444',
    badgeInfo: '#6eb5ff',
    badgePink: '#ec4899',
    badgeNeutral: 'rgba(255,255,255,0.4)',
};

// ── Type Export ───────────────────────────────────────────────────────────────
export type SemanticColors = typeof semanticColors;
