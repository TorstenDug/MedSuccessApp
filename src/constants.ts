/**
 * Application-wide constants for colors, themes, and configuration
 */

// Color Palette
export const COLORS = {
  // Primary brand colors
  primary: '#2563eb',
  primaryLight: '#dbeafe',
  primaryPale: '#f0f9ff',
  
  // Success/Green colors
  success: '#10b981',
  successLight: '#d1fae5',
  successDark: '#047857',
  
  // Error/Red colors
  error: '#ef4444',
  errorLight: '#fee2e2',
  errorDark: '#dc2626',
  
  // Warning/Yellow colors
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  
  // Neutral/Gray colors
  white: '#fff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  black: '#000',
  
  // Text colors
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',
  textPlaceholder: '#aaa',
  
  // Specific UI colors
  purple: '#8b5cf6',
  shadow: '#000',
} as const;

// Status Colors for medication administration
export const STATUS_COLORS = {
  given: COLORS.success,
  missed: COLORS.error,
  created: COLORS.primary,
  deleted: COLORS.gray500,
  discontinued: COLORS.warning,
  'stock-adjustment': COLORS.purple,
} as const;

// Common spacing values
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// Border radius values
export const RADIUS = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
} as const;

// Typography
export const FONT_SIZE = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 32,
} as const;

export const FONT_WEIGHT = {
  normal: '400' as const,
  medium: '600' as const,
  semibold: '700' as const,
  bold: '800' as const,
};

// Shadow presets
export const SHADOW = {
  sm: {
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  md: {
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  lg: {
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
} as const;

// Error messages
export const ERROR_MESSAGES = {
  LOCATION_NOT_FOUND: 'Location not found',
  CLIENT_NOT_FOUND: 'Client not found',
  MEDICATION_NOT_FOUND: 'Medication not found',
  LOAD_DATA_FAILED: 'Failed to load data',
  SAVE_DATA_FAILED: 'Failed to save data',
  DELETE_FAILED: 'Failed to delete',
  UPDATE_FAILED: 'Failed to update',
  UNKNOWN_ERROR: 'An unknown error occurred',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  MEDICATION_RECORDED: 'Medication recorded successfully',
  STOCK_UPDATED: 'Stock updated successfully',
  CLIENT_UPDATED: 'Client updated successfully',
  DELETED_SUCCESS: 'Deleted successfully',
} as const;

// Validation
export const VALIDATION = {
  MIN_NAME_LENGTH: 1,
  MAX_NAME_LENGTH: 100,
  MIN_DOSE: 0,
  MAX_STOCK: 9999,
} as const;
