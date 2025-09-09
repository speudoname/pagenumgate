import { NextRequest, NextResponse } from 'next/server'

/**
 * Shared error handling system for the Komunate platform
 * Combines the best features from all applications for consistent error responses
 */

export interface ApiError {
  code: string
  message: string
  statusCode: number
  details?: any
  timestamp: string
  path?: string
}

export interface ApiSuccess<T = any> {
  data?: T
  message?: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export interface ErrorLog {
  level: 'error' | 'warn' | 'info'
  message: string
  error?: Error
  context?: Record<string, any>
  timestamp: string
  path?: string
}

/**
 * Standard error codes used across the Komunate platform
 */
export const ERROR_CODES = {
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELDS: 'MISSING_FIELDS',
  
  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  
  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  PROXY_ERROR: 'PROXY_ERROR',
  
  // Business logic errors
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  DOMAIN_NOT_FOUND: 'DOMAIN_NOT_FOUND',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // ContactGate specific
  CONTACT_NOT_FOUND: 'CONTACT_NOT_FOUND',
  EMAIL_ERROR: 'EMAIL_ERROR',
  
  // PageNumGate specific
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_OPERATION_FAILED: 'FILE_OPERATION_FAILED',
  AI_ERROR: 'AI_ERROR'
} as const

/**
 * Error status code mapping
 */
const ERROR_STATUS_MAP: Record<string, number> = {
  [ERROR_CODES.UNAUTHORIZED]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.INVALID_TOKEN]: 401,
  [ERROR_CODES.TOKEN_EXPIRED]: 401,
  [ERROR_CODES.VALIDATION_ERROR]: 400,
  [ERROR_CODES.INVALID_INPUT]: 400,
  [ERROR_CODES.MISSING_FIELDS]: 400,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.CONFLICT]: 409,
  [ERROR_CODES.RATE_LIMITED]: 429,
  [ERROR_CODES.INTERNAL_ERROR]: 500,
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 503,
  [ERROR_CODES.DATABASE_ERROR]: 500,
  [ERROR_CODES.PROXY_ERROR]: 502,
  [ERROR_CODES.TENANT_NOT_FOUND]: 404,
  [ERROR_CODES.USER_NOT_FOUND]: 404,
  [ERROR_CODES.DOMAIN_NOT_FOUND]: 404,
  [ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 403,
  [ERROR_CODES.CONTACT_NOT_FOUND]: 404,
  [ERROR_CODES.EMAIL_ERROR]: 500,
  [ERROR_CODES.FILE_NOT_FOUND]: 404,
  [ERROR_CODES.FILE_OPERATION_FAILED]: 500,
  [ERROR_CODES.AI_ERROR]: 500
}

/**
 * Create a standardized API error
 */
export function createApiError(
  code: string,
  message: string,
  details?: any,
  path?: string
): ApiError {
  return {
    code,
    message,
    statusCode: ERROR_STATUS_MAP[code] || 500,
    details,
    timestamp: new Date().toISOString(),
    path
  }
}

/**
 * Log error with context
 */
export function logError(
  level: ErrorLog['level'],
  message: string,
  error?: Error,
  context?: Record<string, any>,
  path?: string
): void {
  const logEntry: ErrorLog = {
    level,
    message,
    error,
    context,
    timestamp: new Date().toISOString(),
    path
  }

  // Log to console in development, structured logging in production
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${level.toUpperCase()}] ${message}`, {
      error: error?.stack,
      context,
      path
    })
  } else {
    // In production, you might want to send to a logging service
    console.error(JSON.stringify(logEntry))
  }
}

/**
 * Handle and format errors for API responses
 */
export function handleApiError(
  error: Error | ApiError,
  path?: string
): { error: ApiError; statusCode: number } {
  let apiError: ApiError

  if ('code' in error && 'statusCode' in error) {
    // Already an ApiError
    apiError = error as ApiError
  } else {
    // Convert Error to ApiError
    const err = error as Error
    apiError = createApiError(
      ERROR_CODES.INTERNAL_ERROR,
      err.message || 'Internal server error',
      undefined,
      path
    )
  }

  // Log the error
  logError('error', apiError.message, error as Error, {
    code: apiError.code,
    statusCode: apiError.statusCode,
    details: apiError.details
  }, path)

  return {
    error: apiError,
    statusCode: apiError.statusCode
  }
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: ApiError,
  request?: NextRequest
): NextResponse {
  const path = request?.nextUrl.pathname || error.path
  const errorWithPath = { ...error, path }

  return NextResponse.json(
    { 
      error: error.message, 
      code: error.code, 
      details: error.details,
      timestamp: error.timestamp,
      path: errorWithPath.path
    },
    { status: error.statusCode }
  )
}

/**
 * Higher-order function to wrap API route handlers with error handling
 * Provides consistent error responses and logging
 */
export function withErrorHandling<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      return await handler(request, ...args)
    } catch (error) {
      const { error: apiError, statusCode } = handleApiError(
        error as Error,
        request.nextUrl.pathname
      )

      return NextResponse.json(
        { error: apiError.message, code: apiError.code, details: apiError.details },
        { status: statusCode }
      )
    }
  }
}

/**
 * Handle validation errors from Zod or other validators
 */
export function handleValidationError(
  validationError: any,
  path?: string
): NextResponse {
  const apiError = createApiError(
    ERROR_CODES.VALIDATION_ERROR,
    'Validation failed',
    validationError.flatten ? validationError.flatten() : validationError,
    path
  )

  return createErrorResponse(apiError)
}

/**
 * Handle database errors
 */
export function handleDatabaseError(
  error: any,
  path?: string
): NextResponse {
  const apiError = createApiError(
    ERROR_CODES.DATABASE_ERROR,
    'Database operation failed',
    process.env.NODE_ENV === 'development' ? error : undefined,
    path
  )

  return createErrorResponse(apiError)
}

/**
 * Shared API Response class that combines ContactGate's ApiResponse with NumGate's error system
 */
export class SharedApiResponse {
  /**
   * Create a success response with optional pagination
   */
  static success<T>(data: T, message?: string, pagination?: ApiSuccess['pagination']) {
    const response: ApiSuccess<T> = { data }
    
    if (message) response.message = message
    if (pagination) response.pagination = pagination
    
    return NextResponse.json(response)
  }

  /**
   * Create an error response with standardized format
   */
  static error(
    code: string,
    message: string,
    statusCode?: number,
    details?: any,
    path?: string
  ) {
    const apiError = createApiError(code, message, details, path)
    if (statusCode) apiError.statusCode = statusCode

    return NextResponse.json(
      { 
        error: apiError.message, 
        code: apiError.code, 
        details: apiError.details,
        timestamp: apiError.timestamp,
        path: apiError.path
      },
      { status: apiError.statusCode }
    )
  }

  /**
   * Convenience methods for common errors
   */
  static unauthorized(message: string = 'Unauthorized', details?: any) {
    return this.error(ERROR_CODES.UNAUTHORIZED, message, 401, details)
  }

  static forbidden(message: string = 'Forbidden', details?: any) {
    return this.error(ERROR_CODES.FORBIDDEN, message, 403, details)
  }

  static notFound(message: string = 'Resource not found', details?: any) {
    return this.error(ERROR_CODES.NOT_FOUND, message, 404, details)
  }

  static badRequest(message: string = 'Bad request', details?: any) {
    return this.error(ERROR_CODES.INVALID_INPUT, message, 400, details)
  }

  static validationError(message: string = 'Validation failed', details?: any) {
    return this.error(ERROR_CODES.VALIDATION_ERROR, message, 422, details)
  }

  static internalError(message: string = 'Internal server error', details?: any) {
    return this.error(ERROR_CODES.INTERNAL_ERROR, message, 500, details)
  }

  static conflict(message: string = 'Resource conflict', details?: any) {
    return this.error(ERROR_CODES.CONFLICT, message, 409, details)
  }

  static rateLimited(message: string = 'Rate limit exceeded', details?: any) {
    return this.error(ERROR_CODES.RATE_LIMITED, message, 429, details)
  }

  /**
   * Business logic specific errors
   */
  static tenantNotFound(tenantId?: string) {
    return this.error(ERROR_CODES.TENANT_NOT_FOUND, 'Tenant not found', 404, { tenantId })
  }

  static userNotFound(userId?: string) {
    return this.error(ERROR_CODES.USER_NOT_FOUND, 'User not found', 404, { userId })
  }

  static domainNotFound(domain?: string) {
    return this.error(ERROR_CODES.DOMAIN_NOT_FOUND, 'Domain not found', 404, { domain })
  }

  static insufficientPermissions(action?: string) {
    return this.error(ERROR_CODES.INSUFFICIENT_PERMISSIONS, 'Insufficient permissions', 403, { action })
  }

  /**
   * Application specific errors
   */
  static contactNotFound(contactId?: string) {
    return this.error(ERROR_CODES.CONTACT_NOT_FOUND, 'Contact not found', 404, { contactId })
  }

  static emailError(message: string = 'Email operation failed', details?: any) {
    return this.error(ERROR_CODES.EMAIL_ERROR, message, 500, details)
  }

  static fileNotFound(fileId?: string) {
    return this.error(ERROR_CODES.FILE_NOT_FOUND, 'File not found', 404, { fileId })
  }

  static fileOperationFailed(operation?: string, details?: any) {
    return this.error(ERROR_CODES.FILE_OPERATION_FAILED, 'File operation failed', 500, { operation, ...details })
  }

  static aiError(message: string = 'AI operation failed', details?: any) {
    return this.error(ERROR_CODES.AI_ERROR, message, 500, details)
  }
}

/**
 * Convenience functions for common errors (NumGate compatibility)
 */
export const ApiErrors = {
  unauthorized: (message = 'Unauthorized', details?: any) => 
    SharedApiResponse.unauthorized(message, details),
  
  forbidden: (message = 'Forbidden', details?: any) => 
    SharedApiResponse.forbidden(message, details),
  
  notFound: (message = 'Resource not found', details?: any) => 
    SharedApiResponse.notFound(message, details),
  
  validationError: (message = 'Validation failed', details?: any) => 
    SharedApiResponse.validationError(message, details),
  
  internalError: (message = 'Internal server error', details?: any) => 
    SharedApiResponse.internalError(message, details),
  
  tenantNotFound: (tenantId?: string) => 
    SharedApiResponse.tenantNotFound(tenantId),
  
  userNotFound: (userId?: string) => 
    SharedApiResponse.userNotFound(userId),
  
  domainNotFound: (domain?: string) => 
    SharedApiResponse.domainNotFound(domain),
  
  insufficientPermissions: (action?: string) => 
    SharedApiResponse.insufficientPermissions(action)
}
