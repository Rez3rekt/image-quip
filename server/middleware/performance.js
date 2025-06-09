const logger = require('../utils/logger');

/**
 * Performance monitoring middleware
 * Tracks response times, memory usage, and request metrics
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byEndpoint: {},
        byStatus: {},
      },
      responseTimes: {
        total: 0,
        count: 0,
        min: Infinity,
        max: 0,
        average: 0,
      },
      errors: {
        total: 0,
        byType: {},
      },
      memory: {
        lastCheck: Date.now(),
        usage: process.memoryUsage(),
      },
    };

    // Log metrics every 5 minutes
    setInterval(() => this.logMetrics(), 5 * 60 * 1000);
  }

  /**
   * Express middleware for performance tracking
   */
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      const startMemory = process.memoryUsage();

      // Track request start
      this.trackRequest(req);

      // Override res.end to capture response metrics
      const originalEnd = res.end;
      res.end = (...args) => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        const endMemory = process.memoryUsage();

        // Track response metrics
        this.trackResponse(req, res, responseTime, startMemory, endMemory);

        // Call original end method
        originalEnd.apply(res, args);
      };

      next();
    };
  }

  /**
   * Track incoming request
   */
  trackRequest(req) {
    this.metrics.requests.total++;

    // Track by method
    const method = req.method;
    this.metrics.requests.byMethod[method] = (this.metrics.requests.byMethod[method] || 0) + 1;

    // Track by endpoint (simplified)
    const endpoint = this.getEndpointPattern(req.originalUrl);
    this.metrics.requests.byEndpoint[endpoint] = (this.metrics.requests.byEndpoint[endpoint] || 0) + 1;
  }

  /**
   * Track response metrics
   */
  trackResponse(req, res, responseTime, startMemory, endMemory) {
    const statusCode = res.statusCode;

    // Track by status code
    const statusGroup = Math.floor(statusCode / 100) * 100;
    this.metrics.requests.byStatus[statusGroup] = (this.metrics.requests.byStatus[statusGroup] || 0) + 1;

    // Track response times
    this.updateResponseTimes(responseTime);

    // Track errors
    if (statusCode >= 400) {
      this.trackError(statusCode, req.originalUrl);
    }

    // Log slow requests
    if (responseTime > 1000) {
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.originalUrl,
        responseTime: `${responseTime}ms`,
        statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });
    }

    // Log memory-intensive requests
    const memoryDiff = endMemory.heapUsed - startMemory.heapUsed;
    if (memoryDiff > 10 * 1024 * 1024) { // 10MB
      logger.warn('Memory-intensive request', {
        method: req.method,
        url: req.originalUrl,
        memoryIncrease: `${Math.round(memoryDiff / 1024 / 1024)}MB`,
        responseTime: `${responseTime}ms`,
      });
    }
  }

  /**
   * Update response time metrics
   */
  updateResponseTimes(responseTime) {
    this.metrics.responseTimes.total += responseTime;
    this.metrics.responseTimes.count++;
    this.metrics.responseTimes.min = Math.min(this.metrics.responseTimes.min, responseTime);
    this.metrics.responseTimes.max = Math.max(this.metrics.responseTimes.max, responseTime);
    this.metrics.responseTimes.average = this.metrics.responseTimes.total / this.metrics.responseTimes.count;
  }

  /**
   * Track error occurrences
   */
  trackError(statusCode, _endpoint) {
    this.metrics.errors.total++;
    const errorType = `${statusCode}`;
    this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;
  }

  /**
   * Simplify endpoint URL for grouping
   */
  getEndpointPattern(url) {
    // Remove query parameters
    const path = url.split('?')[0];
    
    // Replace IDs and codes with placeholders
    return path
      .replace(/\/[0-9a-fA-F]{24}/g, '/:id') // MongoDB ObjectIds
      .replace(/\/[A-Z0-9]{4}/g, '/:code') // Game codes
      .replace(/\/\d+/g, '/:id') // Numeric IDs
      .replace(/\/[^/]+\.(jpg|jpeg|png|gif|webp)$/i, '/:image'); // Image files
  }

  /**
   * Get current system metrics
   */
  getSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      uptime: Math.round(process.uptime()),
      nodeVersion: process.version,
    };
  }

  /**
   * Get performance metrics summary
   */
  getMetrics() {
    return {
      ...this.metrics,
      system: this.getSystemMetrics(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Log performance metrics
   */
  logMetrics() {
    const metrics = this.getMetrics();
    
    logger.info('Performance metrics', {
      requests: {
        total: metrics.requests.total,
        topEndpoints: this.getTopEndpoints(5),
        errorRate: ((metrics.errors.total / metrics.requests.total) * 100).toFixed(2) + '%',
      },
      performance: {
        avgResponseTime: Math.round(metrics.responseTimes.average) + 'ms',
        minResponseTime: metrics.responseTimes.min + 'ms',
        maxResponseTime: metrics.responseTimes.max + 'ms',
      },
      system: metrics.system,
    });

    // Reset some metrics for next period
    this.resetPeriodMetrics();
  }

  /**
   * Get top endpoints by request count
   */
  getTopEndpoints(limit = 5) {
    return Object.entries(this.metrics.requests.byEndpoint)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([endpoint, count]) => ({ endpoint, count }));
  }

  /**
   * Reset metrics that should be calculated per period
   */
  resetPeriodMetrics() {
    // Keep cumulative totals but reset averages
    this.metrics.responseTimes = {
      total: 0,
      count: 0,
      min: Infinity,
      max: 0,
      average: 0,
    };
  }

  /**
   * Health check endpoint data
   */
  getHealthCheck() {
    const metrics = this.getMetrics();
    const isHealthy = 
      metrics.system.memory.heapUsed < 500 && // Less than 500MB heap
      metrics.responseTimes.average < 1000 && // Average response under 1s
      (metrics.errors.total / Math.max(metrics.requests.total, 1)) < 0.1; // Error rate under 10%

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: metrics.system.uptime,
      memory: metrics.system.memory,
      requests: {
        total: metrics.requests.total,
        errorRate: ((metrics.errors.total / Math.max(metrics.requests.total, 1)) * 100).toFixed(2) + '%',
      },
      performance: {
        avgResponseTime: Math.round(metrics.responseTimes.average) + 'ms',
      },
    };
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

module.exports = performanceMonitor; 