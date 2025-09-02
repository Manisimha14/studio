// Lightweight Heuristic Phone Detector
// This worker does not load any heavy AI models.
// It uses simple image analysis to guess if a phone screen is present.

self.onmessage = (event) => {
  const { type, imageData } = event.data;

  if (type === 'init') {
    // No model to load, so we are ready instantly.
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
 * A simple heuristic function to detect a potential phone screen.
 * It checks for a significant number of very dark pixels, which are
 * characteristic of a powered-off or dark-mode phone screen.
 *
 * @param {ImageData} imageData - The image data from a canvas.
 * @returns {boolean} - True if a dark rectangle (potential phone) is detected.
 */
function hasDarkRectangle(imageData) {
  const { data, width, height } = imageData;
  const darkPixelThreshold = 30; // RGB values below this are considered "dark"
  const darkAreaThreshold = 0.15; // If 15% of the image is dark pixels, it's a potential phone

  let darkPixelCount = 0;

  // Iterate through every pixel
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Check if the pixel is dark
    if (r < darkPixelThreshold && g < darkPixelThreshold && b < darkPixelThreshold) {
      darkPixelCount++;
    }
  }

  const totalPixels = width * height;
  const darkAreaRatio = darkPixelCount / totalPixels;

  // If the ratio of dark pixels exceeds our threshold, we flag it.
  return darkAreaRatio > darkAreaThreshold;
}
