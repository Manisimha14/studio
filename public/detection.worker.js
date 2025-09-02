
// detection.worker.js // Lightweight Heuristic Phone Detector

self.onmessage = (event) => {
  const { type, imageData } = event.data;

  if (type === 'init') {
    self.postMessage({ type: 'ready' });
    return;
  }

  if (type === 'detect') {
    if (!imageData) {
      self.postMessage({ type: 'result', isProxyDetected: false });
      return;
    }
    try {
      const isProxyDetected = hasDarkRectangle(imageData);
      self.postMessage({ type: 'result', isProxyDetected });
    } catch (error) {
      console.error('Heuristic detection failed:', error);
      self.postMessage({ type: 'result', isProxyDetected: false });
    }
  }
};

/**
 * A highly optimized heuristic function to detect a potential phone screen.
 * It checks for a significant number of very dark pixels by sampling the image.
 *
 * @param {ImageData} imageData - The image data from a canvas.
 * @returns {boolean} - True if a dark rectangle (potential phone) is detected.
 */
function hasDarkRectangle(imageData) {
  const { data, width, height } = imageData;
  
  // Adjusted thresholds for better accuracy
  const darkPixelThreshold = 20; 
  const darkAreaThreshold = 0.25;

  // OPTIMIZATION: Check 1 in every 8 pixels instead of all of them.
  // This massively reduces computation with minimal impact on accuracy.
  const PIXEL_SAMPLE_RATE = 8;
  const PIXEL_STEP = 4 * PIXEL_SAMPLE_RATE;

  let darkPixelCount = 0;

  // Iterate through a sample of pixels
  for (let i = 0; i < data.length; i += PIXEL_STEP) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (r < darkPixelThreshold && g < darkPixelThreshold && b < darkPixelThreshold) {
      darkPixelCount++;
    }
  }

  // Adjust total pixels to reflect the sample rate for the ratio calculation
  const totalPixelsSampled = (width * height) / PIXEL_SAMPLE_RATE;
  const darkAreaRatio = darkPixelCount / totalPixelsSampled;

  return darkAreaRatio > darkAreaThreshold;
}
