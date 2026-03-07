/**
 * Validation helpers for form inputs and data
 */

import { VALIDATION } from './constants';

export type ValidationResult = {
  isValid: boolean;
  error?: string;
};

/**
 * Validate a required text field
 */
export function validateRequired(value: string | undefined | null, fieldName: string): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { isValid: false, error: `${fieldName} is required` };
  }
  return { isValid: true };
}

/**
 * Validate name (client or medication name)
 */
export function validateName(name: string | undefined | null, fieldName: string = 'Name'): ValidationResult {
  const requiredCheck = validateRequired(name, fieldName);
  if (!requiredCheck.isValid) return requiredCheck;
  
  const trimmed = name!.trim();
  if (trimmed.length < VALIDATION.MIN_NAME_LENGTH) {
    return { isValid: false, error: `${fieldName} must be at least ${VALIDATION.MIN_NAME_LENGTH} character` };
  }
  if (trimmed.length > VALIDATION.MAX_NAME_LENGTH) {
    return { isValid: false, error: `${fieldName} must be less than ${VALIDATION.MAX_NAME_LENGTH} characters` };
  }
  
  return { isValid: true };
}

/**
 * Validate numeric input
 */
export function validateNumber(
  value: string | number | undefined | null,
  fieldName: string,
  options?: { min?: number; max?: number; allowDecimals?: boolean }
): ValidationResult {
  if (value === undefined || value === null || value === '') {
    return { isValid: false, error: `${fieldName} is required` };
  }
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) {
    return { isValid: false, error: `${fieldName} must be a valid number` };
  }
  
  if (!options?.allowDecimals && num !== Math.floor(num)) {
    return { isValid: false, error: `${fieldName} must be a whole number` };
  }
  
  if (options?.min !== undefined && num < options.min) {
    return { isValid: false, error: `${fieldName} must be at least ${options.min}` };
  }
  
  if (options?.max !== undefined && num > options.max) {
    return { isValid: false, error: `${fieldName} must be at most ${options.max}` };
  }
  
  return { isValid: true };
}

/**
 * Validate stock level
 */
export function validateStock(stock: string | number | undefined | null): ValidationResult {
  return validateNumber(stock, 'Stock', { 
    min: VALIDATION.MIN_DOSE, 
    max: VALIDATION.MAX_STOCK,
    allowDecimals: false 
  });
}

/**
 * Validate dose
 */
export function validateDose(dose: string | undefined | null, fieldName: string = 'Dose'): ValidationResult {
  if (!dose || dose.trim().length === 0) {
    return { isValid: false, error: `${fieldName} is required` };
  }
  
  const num = parseFloat(dose);
  if (isNaN(num) || num <= 0) {
    return { isValid: false, error: `${fieldName} must be a positive number` };
  }
  
  return { isValid: true };
}

/**
 * Validate email format
 */
export function validateEmail(email: string | undefined | null): ValidationResult {
  if (!email || email.trim().length === 0) {
    return { isValid: true }; // Email is optional
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { isValid: false, error: 'Invalid email format' };
  }
  
  return { isValid: true };
}

/**
 * Validate date string (YYYY-MM-DD format)
 */
export function validateDate(dateStr: string | undefined | null, fieldName: string = 'Date'): ValidationResult {
  if (!dateStr || dateStr.trim().length === 0) {
    return { isValid: false, error: `${fieldName} is required` };
  }
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return { isValid: false, error: `${fieldName} is not a valid date` };
  }
  
  return { isValid: true };
}

/**
 * Sanitize text input (trim and basic cleanup)
 */
export function sanitizeText(text: string | undefined | null): string {
  if (!text) return '';
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Safely parse integer with fallback
 */
export function safeParseInt(value: string | number | undefined | null, fallback: number = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  return isNaN(num) ? fallback : num;
}

/**
 * Safely parse float with fallback
 */
export function safeParseFloat(value: string | number | undefined | null, fallback: number = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? fallback : num;
}
