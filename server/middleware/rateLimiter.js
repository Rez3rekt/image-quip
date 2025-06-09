const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const ApiResponse = require('../utils/apiResponse');

/**
 * Custom rate limit handler
 */
const rateLimitHandler = (req, res) => {
  logger.warn('Rate limit exceeded', {
    ip: req.ip,
    endpoint: req.originalUrl,
    method: req.method,
    userAgent: req.get('User-Agent'),
  });

  return ApiResponse.rateLimited(res, 'Too many requests. Please try again later.');
};

/**
 * Skip rate limiting for certain conditions
 */
const skipRateLimit = (req) => {
  // Skip rate limiting in test environment
  if (process.env.NODE_ENV === 'test') {
    console.log(`[RATE LIMITER] Skipping rate limit in TEST mode for ${req.ip} ${req.method} ${req.originalUrl}`);
    return true;
  }

  // COMPLETELY skip rate limiting in development mode for easier testing
  if (process.env.NODE_ENV === 'development') {
    console.log(`[RATE LIMITER] Skipping rate limit in DEVELOPMENT mode for ${req.ip} ${req.method} ${req.originalUrl}`);
    console.log(`[RATE LIMITER] NODE_ENV: ${process.env.NODE_ENV}`);
    return true; // Always skip in development
  }

  // Also skip if no NODE_ENV is set (assume development)
  if (!process.env.NODE_ENV) {
    console.log(`[RATE LIMITER] NODE_ENV not set, assuming development - skipping rate limit for ${req.ip} ${req.method} ${req.originalUrl}`);
    return true;
  }

  // Skip for localhost regardless of environment (additional safety)
  if (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1' || req.ip === 'localhost') {
    console.log(`[RATE LIMITER] Skipping rate limit for localhost IP ${req.ip} ${req.method} ${req.originalUrl}`);
    return true;
  }

  console.log(`[RATE LIMITER] NOT skipping rate limit for ${req.ip} ${req.method} ${req.originalUrl} (NODE_ENV: ${process.env.NODE_ENV})`);
  return false;
};

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: rateLimitHandler,
  skip: skipRateLimit,
});

/**
 * Strict rate limiter for authentication endpoints
 * 5 requests per 15 minutes per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipRateLimit,
});

/**
 * File upload rate limiter
 * 10 uploads per hour per IP
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 uploads per hour
  message: 'Too many file uploads, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipRateLimit,
});

/**
 * Card creation rate limiter
 * 20 card operations per hour per IP
 */
const cardLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 card operations per hour
  message: 'Too many card operations, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipRateLimit,
});

/**
 * Game creation rate limiter
 * 10 games per hour per IP
 */
const gameLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 game creations per hour
  message: 'Too many game creation attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipRateLimit,
});

/**
 * Lenient rate limiter for read operations
 * 200 requests per 15 minutes per IP
 */
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Higher limit for read operations
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipRateLimit,
});

/**
 * WebSocket connection rate limiter
 * 30 connections per 5 minutes per IP
 */
const websocketLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // Limit WebSocket connections
  message: 'Too many connection attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipRateLimit,
});

module.exports = {
  generalLimiter,
  authLimiter,
  uploadLimiter,
  cardLimiter,
  gameLimiter,
  readLimiter,
  websocketLimiter,
}; 