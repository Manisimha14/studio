
// --- Constants and Configuration ---
const TF_VERSION = '3.11.0';
const COCO_SSD_VERSION = '2.2.2';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const TIMEOUTS = [8000, 12000, 20000]; // Progressive timeouts for each attempt

// --- CDN Fallback Configuration ---
const CDN_SOURCES = [
  'https://cdn.jsdelivr.net/npm', // Primary: jsdelivr
  'https://unpkg.com',           // Secondary: unpkg
  'https://cdn.skypack.dev'       // Tertiary: skypack
];

// --- State Variables ---
let model = null;
let isDetecting = false;
let currentCdnIndex = 0;

// --- Helper Functions ---

// Dynamically import scripts from a CDN with a timeout
function importScriptWithTimeout(url, timeout) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(`Script timeout: ${url}`)), timeout);
    try {
      importScripts(url);
      clearTimeout(timeoutId);
      resolve();
    } catch (e) {
      clearTimeout(timeoutId);
      reject(e);
    }
  });
}

// Attempts to load the AI model with retry logic
async function loadModel(attempt = 1) {
  if (model) return { backend: tf.getBackend() };

  const timeout = TIMEOUTS[attempt - 1] || TIMEOUTS[TIMEOUTS.length - 1];
  
  try {
    const tfUrl = `${CDN_SOURCES[currentCdnIndex]}/@tensorflow/tfjs@${TF_VERSION}/dist/tf.min.js`;
    const cocoUrl = `${CDN_SOURCES[currentCdnIndex]}/@tensorflow-models/coco-ssd@${COCO_SSD_VERSION}/dist/coco-ssd.min.js`;

    await importScriptWithTimeout(tfUrl, timeout);
    await importScriptWithTimeout(cocoUrl, timeout);

    // Set backend with fallbacks
    try {
      await tf.setBackend('webgl');
    } catch (e) {
      console.warn('WebGL backend failed, falling back to WASM/CPU.');
      self.postMessage({ type: 'error', error: 'WebGL backend not available, performance may be reduced.', critical: false });
      await tf.setBackend('wasm');
    }
    
    // Load the lite model for performance
    model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
    console.log(`Model loaded successfully on attempt ${attempt} from ${CDN_SOURCES[currentCdnIndex]} with ${tf.getBackend()} backend.`);
    
    return { 
      backend: tf.getBackend(), 
      memory: tf.memory(),
      attempt: attempt
    };

  } catch (error) {
    console.error(`Attempt ${attempt} failed with CDN ${CDN_SOURCES[currentCdnIndex]}:`, error);
    
    // Try the next CDN source if available
    currentCdnIndex++;
    if (currentCdnIndex < CDN_SOURCES.length) {
      console.log(`Switching to next CDN: ${CDN_SOURCES[currentCdnIndex]}`);
      return loadModel(attempt); // Retry with the same attempt number but new CDN
    }

    // If all CDNs for this attempt have failed, move to the next retry attempt
    currentCdnIndex = 0; // Reset CDN index for the next attempt
    if (attempt < MAX_RETRIES) {
      console.log(`Waiting ${RETRY_DELAY_MS}ms before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return loadModel(attempt + 1);
    } else {
      throw new Error(`AI model failed to load after ${MAX_RETRIES} attempts. Please check network connection.`);
    }
  }
}

// --- Message Handling ---
self.onmessage = async (event) => {
  const { type, imageData } = event.data;

  switch (type) {
    case 'init':
      try {
        const systemInfo = await loadModel();
        self.postMessage({ type: 'ready', ...systemInfo });
      } catch (error) {
        self.postMessage({ type: 'error', error: error.message, critical: true });
      }
      break;

    case 'detect':
      if (!model || !imageData || isDetecting) return;
      isDetecting = true;
      
      try {
        const tensor = tf.browser.fromPixels(imageData);
        const predictions = await model.detect(tensor);
        tensor.dispose();

        const devices = predictions
          .filter(p => ['cell phone', 'laptop', 'tv', 'tablet'].includes(p.class) && p.score > 0.25)
          .map(p => ({
            type: p.class,
            confidence: p.score,
            area: p.bbox[2] * p.bbox[3]
          }));

        self.postMessage({
          type: 'result',
          isProxyDetected: devices.length > 0,
          deviceCount: devices.length,
          devices: devices
        });

      } catch (error) {
        console.error('Detection error:', error);
      } finally {
        isDetecting = false;
      }
      break;
      
    case 'cleanup':
      if (model && model.dispose) {
        model.dispose();
      }
      model = null;
      if (typeof tf !== 'undefined' && tf.disposeVariables) {
        tf.disposeVariables();
      }
      console.log('Worker cleaned up resources.');
      break;
  }
};
