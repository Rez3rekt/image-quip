const Joi = require('joi');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * Validation middleware factory
 * @param {Object} schema - Joi validation schema
 * @param {string} property - Property to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Return all validation errors
      stripUnknown: true, // Remove unknown properties
      convert: true, // Convert types when possible
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
      }));

      logger.warn('Validation failed', {
        endpoint: req.originalUrl,
        method: req.method,
        property,
        errors: validationErrors,
      });

      return ApiResponse.validationError(res, validationErrors, 'Invalid input data');
    }

    // Replace the original data with validated/sanitized data
    req[property] = value;
    next();
  };
};

/**
 * Common validation schemas
 */
const schemas = {
  // User authentication schemas
  register: Joi.object({
    username: Joi.string()
      .alphanum()
      .min(3)
      .max(20)
      .required()
      .messages({
        'string.alphanum': 'Username must contain only letters and numbers',
        'string.min': 'Username must be at least 3 characters long',
        'string.max': 'Username cannot exceed 20 characters',
      }),
    password: Joi.string()
      .min(6)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required()
      .messages({
        'string.min': 'Password must be at least 6 characters long',
        'string.max': 'Password cannot exceed 128 characters',
        'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
      }),
    email: Joi.string()
      .email()
      .optional()
      .messages({
        'string.email': 'Please provide a valid email address',
      }),
  }),

  login: Joi.object({
    username: Joi.string()
      .alphanum()
      .min(3)
      .max(20)
      .required(),
    password: Joi.string()
      .min(6)
      .max(128)
      .required(),
  }),

  // Game-related schemas
  createGame: Joi.object({
    gameCode: Joi.string()
      .length(4)
      .pattern(/^[A-Z0-9]{4}$/)
      .optional()
      .messages({
        'string.length': 'Game code must be exactly 4 characters',
        'string.pattern.base': 'Game code must contain only uppercase letters and numbers',
      }),
    maxPlayers: Joi.number()
      .integer()
      .min(2)
      .max(20)
      .default(8)
      .messages({
        'number.min': 'Game must allow at least 2 players',
        'number.max': 'Game cannot exceed 20 players',
      }),
    roundsToWin: Joi.number()
      .integer()
      .min(1)
      .max(10)
      .default(3)
      .messages({
        'number.min': 'Must play at least 1 round to win',
        'number.max': 'Cannot exceed 10 rounds to win',
      }),
    timeLimit: Joi.number()
      .integer()
      .min(30)
      .max(300)
      .default(120)
      .messages({
        'number.min': 'Time limit must be at least 30 seconds',
        'number.max': 'Time limit cannot exceed 5 minutes',
      }),
  }),

  joinGame: Joi.object({
    gameCode: Joi.string()
      .length(4)
      .pattern(/^[A-Z0-9]{4}$/)
      .required()
      .messages({
        'string.length': 'Game code must be exactly 4 characters',
        'string.pattern.base': 'Game code must contain only uppercase letters and numbers',
      }),
    nickname: Joi.string()
      .min(1)
      .max(20)
      .pattern(/^[a-zA-Z0-9\s_-]+$/)
      .required()
      .messages({
        'string.min': 'Nickname cannot be empty',
        'string.max': 'Nickname cannot exceed 20 characters',
        'string.pattern.base': 'Nickname can only contain letters, numbers, spaces, underscores, and hyphens',
      }),
  }),

  // Card-related schemas
  addCard: Joi.object({
    imagePath: Joi.string()
      .uri({ relativeOnly: true })
      .required()
      .messages({
        'string.uri': 'Invalid image path format',
      }),
  }),

  uploadCard: Joi.object({
    title: Joi.string()
      .min(1)
      .max(100)
      .optional()
      .messages({
        'string.max': 'Card title cannot exceed 100 characters',
      }),
    description: Joi.string()
      .max(500)
      .optional()
      .messages({
        'string.max': 'Card description cannot exceed 500 characters',
      }),
    tags: Joi.array()
      .items(Joi.string().max(20))
      .max(10)
      .optional()
      .messages({
        'array.max': 'Cannot have more than 10 tags',
      }),
  }),

  // Game action schemas
  selectCard: Joi.object({
    cardPath: Joi.string()
      .required()
      .messages({
        'any.required': 'Card selection is required',
      }),
  }),

  submitVote: Joi.object({
    cardPath: Joi.string()
      .required()
      .messages({
        'any.required': 'Vote selection is required',
      }),
  }),

  // Query parameter schemas
  pagination: Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .default(1),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(20),
    sort: Joi.string()
      .valid('created', 'updated', 'name', 'popularity')
      .default('created'),
    order: Joi.string()
      .valid('asc', 'desc')
      .default('desc'),
  }),

  // Search schemas
  search: Joi.object({
    q: Joi.string()
      .min(1)
      .max(100)
      .required()
      .messages({
        'string.min': 'Search query cannot be empty',
        'string.max': 'Search query cannot exceed 100 characters',
      }),
    category: Joi.string()
      .valid('cards', 'games', 'users')
      .optional(),
  }),

  // ID parameter validation
  mongoId: Joi.object({
    id: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid ID format',
      }),
  }),

  gameCode: Joi.object({
    gameCode: Joi.string()
      .length(4)
      .pattern(/^[A-Z0-9]{4}$/)
      .required()
      .messages({
        'string.length': 'Game code must be exactly 4 characters',
        'string.pattern.base': 'Game code must contain only uppercase letters and numbers',
      }),
  }),
};

/**
 * Sanitize HTML content to prevent XSS
 */
const sanitizeHtml = (text) => {
  if (typeof text !== 'string') {return text;}
  
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Middleware to sanitize request data
 */
const sanitizeInput = (req, res, next) => {
  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) {return obj;}
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeHtml(value.trim());
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

module.exports = {
  validate,
  schemas,
  sanitizeInput,
}; 