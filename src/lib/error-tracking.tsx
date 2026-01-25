import React from 'react';

/**
 * Error Tracking and Monitoring
 * 
 * This module provides error tracking capabilities.
 * Sentry integration is disabled - enable by installing @sentry/react and configuring VITE_SENTRY_DSN
 */

interface ErrorContext {
  user?: {
    id: string;
    email?: string;
  };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

class ErrorTracker {
  private isProduction: boolean;

  constructor() {
    this.isProduction = import.meta.env.PROD;
  }

  /**
   * Initialize error tracking
   */
  async init() {
    console.info('Error tracking disabled - Sentry not installed');
  }

  /**
   * Capture an exception
   */
  captureException(error: Error, context?: ErrorContext) {
    console.error('Error:', error, context);
  }

  /**
   * Capture a message
   */
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext) {
    console[level]('Message:', message, context);
  }

  /**
   * Set user context
   */
  setUser(_user: { id: string; email?: string; username?: string } | null) {
    // No-op when Sentry is disabled
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(_message: string, _category: string, _data?: Record<string, unknown>) {
    // No-op when Sentry is disabled
  }

  /**
   * Start a performance transaction
   */
  startTransaction(_name: string, _op: string) {
    return Promise.resolve(null);
  }
}

// Export singleton instance
export const errorTracker = new ErrorTracker();

/**
 * Simple Error Fallback Component
 */
export function ErrorFallback({ 
  error, 
  resetError 
}: { 
  error: Error; 
  resetError: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-lg p-6 text-center">
        <h2 className="text-2xl font-bold text-destructive mb-4">
          Something went wrong
        </h2>
        <p className="text-muted-foreground mb-4">
          {error.message || "We've encountered an unexpected error."}
        </p>
        <button
          onClick={resetError}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

/**
 * Hook for error tracking in components
 */
export function useErrorTracking() {
  return {
    captureException: errorTracker.captureException.bind(errorTracker),
    captureMessage: errorTracker.captureMessage.bind(errorTracker),
    addBreadcrumb: errorTracker.addBreadcrumb.bind(errorTracker),
  };
}

/**
 * Performance monitoring helper
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - startTime;
    
    errorTracker.addBreadcrumb(
      `${name} completed`,
      'performance',
      { duration: `${duration.toFixed(2)}ms` }
    );
    
    return result;
  } catch (error) {
    errorTracker.captureException(error as Error, {
      tags: { operation: name },
    });
    throw error;
  }
}
