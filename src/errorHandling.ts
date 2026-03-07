/**
 * Centralized error handling utilities
 */

import { Alert } from 'react-native';
import { ERROR_MESSAGES } from './constants';

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return ERROR_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Show error alert with consistent formatting
 */
export function showError(
  error: unknown,
  context?: string,
  onOk?: () => void
): void {
  const message = getErrorMessage(error);
  const title = context ? `Error: ${context}` : 'Error';
  
  Alert.alert(
    title,
    message,
    onOk ? [{ text: 'OK', onPress: onOk }] : [{ text: 'OK' }]
  );
}

/**
 * Show success alert with consistent formatting
 */
export function showSuccess(
  message: string,
  onOk?: () => void
): void {
  Alert.alert(
    'Success',
    message,
    onOk ? [{ text: 'OK', onPress: onOk }] : [{ text: 'OK' }]
  );
}

/**
 * Show confirmation dialog
 */
export function showConfirmation(
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
): void {
  Alert.alert(
    title,
    message,
    [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: onCancel,
      },
      {
        text: 'Confirm',
        onPress: onConfirm,
      },
    ]
  );
}

/**
 * Log error to console in development
 */
export function logError(error: unknown, context?: string): void {
  if (__DEV__) {
    const message = getErrorMessage(error);
    const prefix = context ? `[${context}]` : '[Error]';
    console.error(prefix, message, error);
  }
}

/**
 * Handle async errors with consistent logging and user feedback
 */
export async function handleAsync<T>(
  promise: Promise<T>,
  context?: string,
  showAlert: boolean = true
): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    logError(error, context);
    if (showAlert) {
      showError(error, context);
    }
    return null;
  }
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<Args extends any[], Result>(
  fn: (...args: Args) => Promise<Result>,
  context?: string
): (...args: Args) => Promise<Result | null> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error, context);
      showError(error, context);
      return null;
    }
  };
}
