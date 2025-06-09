const sharp = require('sharp');
const logger = require('./logger');

class ImageOptimizer {
  constructor() {
    this.maxWidth = 1920;
    this.maxHeight = 1080;
    this.quality = 85;
    this.webpQuality = 80;
    this.maxFileSize = 2 * 1024 * 1024; // 2MB
  }

  /**
   * Optimize an image buffer and return optimized buffer
   * @param {Buffer} inputBuffer - Original image buffer
   * @param {Object} options - Optimization options
   * @returns {Promise<{buffer: Buffer, format: string, size: number}>}
   */
  async optimizeImage(inputBuffer, options = {}) {
    try {
      const {
        maxWidth = this.maxWidth,
        maxHeight = this.maxHeight,
        quality = this.quality,
        format = 'auto', // 'auto', 'jpeg', 'webp', 'png'
        progressive = true,
      } = options;

      // Get image metadata
      const metadata = await sharp(inputBuffer).metadata();
      logger.info('Image optimization started', {
        originalFormat: metadata.format,
        originalSize: inputBuffer.length,
        originalDimensions: `${metadata.width}x${metadata.height}`,
      });

      let pipeline = sharp(inputBuffer);

      // Resize if image is too large
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        pipeline = pipeline.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      // Determine output format
      let outputFormat = format;
      if (format === 'auto') {
        // Use WebP for better compression, fallback to JPEG
        outputFormat = 'webp';
      }

      // Apply format-specific optimizations
      let optimizedBuffer;
      switch (outputFormat) {
        case 'webp':
          optimizedBuffer = await pipeline
            .webp({
              quality: this.webpQuality,
              effort: 4, // Balance between compression and speed
            })
            .toBuffer();
          break;

        case 'jpeg':
        case 'jpg':
          optimizedBuffer = await pipeline
            .jpeg({
              quality,
              progressive,
              mozjpeg: true, // Use mozjpeg encoder for better compression
            })
            .toBuffer();
          break;

        case 'png':
          optimizedBuffer = await pipeline
            .png({
              compressionLevel: 8,
              progressive,
            })
            .toBuffer();
          break;

        default:
          // Fallback to JPEG
          optimizedBuffer = await pipeline
            .jpeg({
              quality,
              progressive,
            })
            .toBuffer();
          outputFormat = 'jpeg';
      }

      const compressionRatio = ((inputBuffer.length - optimizedBuffer.length) / inputBuffer.length * 100).toFixed(1);
      
      logger.info('Image optimization completed', {
        outputFormat,
        outputSize: optimizedBuffer.length,
        compressionRatio: `${compressionRatio}%`,
        sizeSaved: inputBuffer.length - optimizedBuffer.length,
      });

      return {
        buffer: optimizedBuffer,
        format: outputFormat,
        size: optimizedBuffer.length,
        metadata: {
          originalSize: inputBuffer.length,
          compressionRatio: parseFloat(compressionRatio),
        },
      };

    } catch (error) {
      logger.error('Image optimization failed', {
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Image optimization failed: ${error.message}`);
    }
  }

  /**
   * Create multiple sizes/formats of an image
   * @param {Buffer} inputBuffer - Original image buffer
   * @param {string} baseName - Base filename without extension
   * @returns {Promise<Array>} Array of optimized image variants
   */
  async createImageVariants(inputBuffer, baseName) {
    try {
      const variants = [];

      // Original optimized version (WebP)
      const webpOptimized = await this.optimizeImage(inputBuffer, {
        format: 'webp',
        quality: this.webpQuality,
      });
      variants.push({
        filename: `${baseName}.webp`,
        buffer: webpOptimized.buffer,
        format: 'webp',
        size: webpOptimized.size,
        type: 'optimized',
      });

      // JPEG fallback for compatibility
      const jpegOptimized = await this.optimizeImage(inputBuffer, {
        format: 'jpeg',
        quality: this.quality,
      });
      variants.push({
        filename: `${baseName}.jpg`,
        buffer: jpegOptimized.buffer,
        format: 'jpeg',
        size: jpegOptimized.size,
        type: 'fallback',
      });

      // Thumbnail version (WebP)
      const thumbnail = await this.optimizeImage(inputBuffer, {
        format: 'webp',
        maxWidth: 400,
        maxHeight: 300,
        quality: 75,
      });
      variants.push({
        filename: `${baseName}_thumb.webp`,
        buffer: thumbnail.buffer,
        format: 'webp',
        size: thumbnail.size,
        type: 'thumbnail',
      });

      return variants;

    } catch (error) {
      logger.error('Failed to create image variants', {
        error: error.message,
        baseName,
      });
      throw error;
    }
  }

  /**
   * Validate image file
   * @param {Buffer} buffer - Image buffer
   * @returns {Promise<boolean>}
   */
  async validateImage(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      
      // Check file size
      if (buffer.length > this.maxFileSize) {
        throw new Error(`File size ${buffer.length} exceeds maximum ${this.maxFileSize}`);
      }

      // Check dimensions
      if (metadata.width > 4000 || metadata.height > 4000) {
        throw new Error(`Image dimensions ${metadata.width}x${metadata.height} too large`);
      }

      // Check format
      const supportedFormats = ['jpeg', 'jpg', 'png', 'webp', 'gif'];
      if (!supportedFormats.includes(metadata.format)) {
        throw new Error(`Unsupported format: ${metadata.format}`);
      }

      return true;

    } catch (error) {
      logger.warn('Image validation failed', {
        error: error.message,
        bufferSize: buffer.length,
      });
      throw error;
    }
  }

  /**
   * Get image information without processing
   * @param {Buffer} buffer - Image buffer
   * @returns {Promise<Object>}
   */
  async getImageInfo(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      return {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        size: buffer.length,
        hasAlpha: metadata.hasAlpha,
        channels: metadata.channels,
      };
    } catch (error) {
      logger.error('Failed to get image info', { error: error.message });
      throw error;
    }
  }
}

// Create singleton instance
const imageOptimizer = new ImageOptimizer();

module.exports = imageOptimizer; 