// Single source of truth for the product name. Rename here only.
export const APP_NAME = 'ORI'
export const APP_TAGLINE = 'One private balance. Every chain.'

// Screens hidden for the NEAR hackathon submission (cut-down scope). Remove an id to bring it back.
export const HIDDEN_SCREENS: readonly string[] = ['scan', 'earn', 'privacy']
export const isHiddenScreen = (s: string) => HIDDEN_SCREENS.includes(s)
