/**
 * Creates an Image object from a source URL.
 * @param {string} url - The image source URL.
 * @returns {Promise<HTMLImageElement>} A promise that resolves with the Image object.
 */
const createImage = url =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', error => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); // needed to avoid cross-origin issues on CodeSandbox
    image.src = url;
  });

/**
 * Converts degrees to radians.
 * @param {number} degree - Angle in degrees.
 * @returns {number} Angle in radians.
 */
function degToRad(degree) {
  return (degree * Math.PI) / 180;
}

/**
 * Returns the new bounding area of a rotated rectangle.
 * @param {number} width - The original width.
 * @param {number} height - The original height.
 * @param {number} rotation - Rotation angle in degrees.
 * @returns {{ width: number, height: number }}
 */
function rotateSize(width, height, rotation) {
  const rotRad = degToRad(rotation);
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

/**
 * This function was adapted from the one in the ReadMe of https://github.com/DominicTobias/react-image-crop
 *
 * @param {string} imageSrc - Image File url
 * @param {Object} pixelCrop - pixelCrop Object provided by react-easy-crop
 * @param {number} rotation - Rotation angle in degrees
 * @param {Object} flip - Flip object { horizontal: boolean, vertical: boolean }
 * @param {string} outputType - 'blob' or 'base64' (defaults to 'blob')
 * @returns {Promise<Blob | string | null>} A promise that resolves with the Blob or base64 data URL, or null.
 */
export async function getCroppedImg(
  imageSrc,
  pixelCrop,
  rotation = 0,
  flip = { horizontal: false, vertical: false },
  outputType = 'blob',
) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  const rotRad = degToRad(rotation);
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.naturalWidth,
    image.naturalHeight,
    rotation,
  );

  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
  ctx.translate(-image.naturalWidth / 2, -image.naturalHeight / 2);

  ctx.drawImage(image, 0, 0);

  const cropCanvas = document.createElement('canvas');
  const cropCtx = cropCanvas.getContext('2d');
  if (!cropCtx) {
    return null;
  }

  cropCanvas.width = pixelCrop.width;
  cropCanvas.height = pixelCrop.height;

  cropCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise((resolve, reject) => {
    if (outputType === 'blob') {
      cropCanvas.toBlob(
        blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas is empty'));
          }
        },
        'image/png',
        0.9,
      );
    } else {
      resolve(cropCanvas.toDataURL('image/png'));
    }
  });
}

/**
 * Compresses an image to reduce file size for mobile uploads
 * @param {Blob} blob - The image blob to compress
 * @param {Object} options - Compression options
 * @param {number} options.maxWidth - Maximum width (default 1200px)
 * @param {number} options.maxHeight - Maximum height (default 1200px)
 * @param {number} options.quality - JPEG quality (0-1, default 0.8)
 * @param {boolean} options.isMobile - If true, applies more aggressive compression
 * @returns {Promise<Blob>} A promise that resolves with the compressed image blob
 */
export async function compressImage(blob, options = {}) {
  const { maxWidth = 1200, maxHeight = 1200, quality = 0.8, isMobile = false } = options;

  // For mobile, reduce quality further to save bandwidth
  const finalQuality = isMobile ? Math.min(quality, 0.7) : quality;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(img.src);

      // Calculate new dimensions while maintaining aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Image compression failed'));
          }
        },
        'image/jpeg',
        finalQuality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image for compression'));
    };
  });
}

/**
 * Enhanced version of getCroppedImg that also compresses the output for mobile
 * @param {string} imageSrc - Image File url
 * @param {Object} pixelCrop - pixelCrop Object provided by react-easy-crop
 * @param {number} rotation - Rotation angle in degrees
 * @param {Object} flip - Flip object { horizontal: boolean, vertical: boolean }
 * @param {boolean} isMobile - Whether the user is on a mobile device
 * @returns {Promise<Blob>} A promise that resolves with the cropped and compressed image blob
 */
export async function getCroppedImgOptimized(
  imageSrc,
  pixelCrop,
  rotation = 0,
  flip = { horizontal: false, vertical: false },
  isMobile = false,
) {
  // First get the cropped image
  const croppedBlob = await getCroppedImg(imageSrc, pixelCrop, rotation, flip, 'blob');

  if (!croppedBlob) {
    return null;
  }

  // Then compress it
  try {
    return await compressImage(croppedBlob, {
      maxWidth: isMobile ? 800 : 1200,
      maxHeight: isMobile ? 800 : 1200,
      quality: isMobile ? 0.7 : 0.85,
      isMobile,
    });
  } catch (error) {
    console.error('Image compression failed:', error);
    // Fall back to the original cropped image if compression fails
    return croppedBlob;
  }
}
