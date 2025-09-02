// public/detection.worker.js - Production Grade
// Implements CDN fallbacks, retry logic, and robust error handling.

// --- Configuration ---
const TF_VERSION = "4.20.0";
const COCO_SSD_VERSION = "2.2.3";
const MODEL_CONFIG = { base: 'lite_mobilenet_v2' };
const DETECTION_THRESHOLD = 0.40; // Confidence threshold for detection
const PROXY_CLASSES = ['cell phone', 'laptop', 'tablet', 'tv', 'remote', 'mouse', 'keyboard', 'book'];

const CDN_URLS = {
  tfjs: [
    `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@${TF_VERSION}/dist/tf.min.js`,
    `https://unpkg.com/@tensorflow/tfjs@${TF_VERSION}/dist/tf.min.js`
  ],
  cocoSsd: [
    `https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@${COCO_SSD_VERSION}/dist/coco-ssd.min.js`,
    `https://unpkg.com/@tensorflow-models/coco-ssd@${COCO_SSD_VERSION}/dist/coco-ssd.min.js`
  ]
};

// --- State ---
let model = null;
let isDetecting = false;

// --- Core Functions ---

/**
 * Tries to import scripts from a list of URLs, falling back to the next on failure.
 * @param {string[]} urls - Array of script URLs to try.
 */
async function importScriptsWithFallback(urls) {
  for (const url of urls) {
    try {
      importScripts(url);
      console.log(`Successfully loaded script from ${url}`);
      return;
    } catch (e) {
      console.warn(`Failed to load script from ${url}, trying next fallback...`);
    }
  }
  throw new Error('Failed to load critical scripts from all CDN fallbacks.');
}

/**
 * Loads the COCO-SSD model with retries and backend fallbacks.
 */
async function loadModelWithRetries(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (model) return { backend: tf.getBackend() };

      await importScriptsWithFallback(CDN_URLS.tfjs);
      await importScriptsWithFallback(CDN_URLS.cocoSsd);

      // 1. Try WebGL backend (GPU)
      try {
        await tf.setBackend('webgl');
        await tf.ready();
        model = await cocoSsd.load(MODEL_CONFIG);
        console.log(`AI model loaded with WebGL backend (Attempt ${attempt})`);
        return { backend: 'webgl' };
      } catch (e) {
        console.warn(`WebGL backend failed (Attempt ${attempt}):`, e.message);
      }

      // 2. Fallback to CPU backend
      await tf.setBackend('cpu');
      await tf.ready();
      model = await cocoSsd.load(MODEL_CONFIG);
      console.log(`AI model loaded with CPU backend (Attempt ${attempt})`);
      return { backend: 'cpu' };

    } catch (error) {
      console.error(`Model loading attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) {
        throw new Error('All model loading attempts failed.');
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}


// --- Worker Message Handler ---

self.onmessage = async (event) => {
  const { type, imageData } = event.data;

  if (type === 'init') {
    try {
      const { backend } = await loadModelWithRetries();
      self.postMessage({ type: 'ready', backend });
    } catch (error) {
      self.postMessage({ type: 'error', error: error.message, critical: true });
    }
    return;
  }

  if (type === 'detect') {
    if (!model || !imageData || isDetecting) return;

    isDetecting = true;
    try {
      const tensor = tf.browser.fromPixels(imageData);
      const predictions = await model.detect(tensor);
      tensor.dispose();

      const detectedDevices = predictions.filter(p => 
        PROXY_CLASSES.includes(p.class) && p.score > DETECTION_THRESHOLD
      );

      self.postMessage({
        type: 'result',
        isProxyDetected: detectedDevices.length > 0,
        devices: detectedDevices.map(d => ({ type: d.class, confidence: d.score })),
        deviceCount: detectedDevices.length,
      });

    } catch (error) {
      console.error('AI detection failed:', error);
      self.postMessage({ type: 'result', isProxyDetected: false }); // Fail safe
    } finally {
      isDetecting = false;
    }
  }
  
  if (type === 'cleanup') {
      if (model && typeof model.dispose === 'function') {
          model.dispose();
      }
      model = null;
      tf.disposeVariables();
      console.log('Worker resources cleaned up.');
  }
};

// --- Global Error Handler ---
self.onerror = (error) => {
  console.error('Unhandled worker error:', error);
  self.postMessage({
    type: 'error',
    error: 'A critical worker error occurred.',
    critical: true
  });
};
