const logger = require('./logger');

/**
 * Standardized API Response Utility
 * Provides consistent response formats across all endpoints
 */
class ApiResponse {
  /**
   * Send a successful response
   * @param {Object} res - Express response object
   * @param {*} data - Response data
   * @param {string} message - Success message
   * @param {number} statusCode - HTTP status code (default: 200)
   */
  static success(res, data = null, message = 'Success', statusCode = 200) {
    const response = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    };

    // Log successful operations (except for frequent operations)
    if (statusCode === 201 || statusCode === 204) {
      logger.info('API Success', {
        statusCode,
        message,
        endpoint: res.req?.originalUrl,
        method: res.req?.method,
      });
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Send an error response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code (default: 400)
   * @param {*} details - Additional error details
   * @param {string} errorCode - Application-specific error code
   */
  static error(res, message = 'An error occurred', statusCode = 400, details = null, errorCode = null) {
    const response = {
      success: false,
      message,
      error: {
        code: errorCode,
        details,
        statusCode,
      },
      timestamp: new Date().toISOString(),
    };

    // Log error details
    logger.error('API Error', {
      statusCode,
      message,
      errorCode,
      details,
      endpoint: res.req?.originalUrl,
      method: res.req?.method,
      userAgent: res.req?.get('User-Agent'),
      ip: res.req?.ip,
    });

    return res.status(statusCode).json(response);
  }

  /**
   * Send a validation error response
   * @param {Object} res - Express response object
   * @param {Array|Object} validationErrors - Validation error details
   * @param {string} message - Error message
   */
  static validationError(res, validationErrors, message = 'Validation failed') {
    return this.error(res, message, 422, validationErrors, 'VALIDATION_ERROR');
  }

  /**
   * Send an authentication error response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   */
  static unauthorized(res, message = 'Authentication required') {
    return this.error(res, message, 401, null, 'UNAUTHORIZED');
  }

  /**
   * Send a forbidden error response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   */
  static forbidden(res, message = 'Access forbidden') {
    return this.error(res, message, 403, null, 'FORBIDDEN');
  }

  /**
   * Send a not found error response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   */
  static notFound(res, message = 'Resource not found') {
    return this.error(res, message, 404, null, 'NOT_FOUND');
  }

  /**
   * Send a conflict error response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   */
  static conflict(res, message = 'Resource conflict') {
    return this.error(res, message, 409, null, 'CONFLICT');
  }

  /**
   * Send an internal server error response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {Error} error - Original error object
   */
  static internalError(res, message = 'Internal server error', error = null) {
    // Log the full error for debugging
    if (error) {
      logger.error('Internal Server Error', {
        message: error.message,
        stack: error.stack,
        endpoint: res.req?.originalUrl,
        method: res.req?.method,
      });
    }

    // Don't expose internal error details in production
    const details = process.env.NODE_ENV === 'development' ? error?.message : null;
    
    return this.error(res, message, 500, details, 'INTERNAL_ERROR');
  }

  /**
   * Send a rate limit error response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   */
  static rateLimited(res, message = 'Too many requests') {
    return this.error(res, message, 429, null, 'RATE_LIMITED');
  }

  /**
   * Send a paginated response
   * @param {Object} res - Express response object
   * @param {Array} data - Array of items
   * @param {Object} pagination - Pagination metadata
   * @param {string} message - Success message
   */
  static paginated(res, data, pagination, message = 'Success') {
    const response = {
      success: true,
      message,
      data,
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total: pagination.total || data.length,
        totalPages: pagination.totalPages || Math.ceil((pagination.total || data.length) / (pagination.limit || 10)),
        hasNext: pagination.hasNext || false,
        hasPrev: pagination.hasPrev || false,
      },
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json(response);
  }

  /**
   * Handle async route errors
   * @param {Function} fn - Async route handler
   * @returns {Function} Express middleware
   */
  static asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

module.exports = ApiResponse; 