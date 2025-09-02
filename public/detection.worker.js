// public/detection.worker.js - Industry-Grade Mobile Detection Worker

// Try to import scripts with error handling
try {
  importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/dist/tf.min.js");
  importScripts("https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd/dist/coco-ssd.min.js");
} catch (e) {
  console.error("Failed to load TensorFlow.js scripts", e);
  self.postMessage({ type: 'error', error: 'Could not load core AI libraries.' });
}

let model = null;
let isDetecting = false;
let frameCounter = 0;
const FRAME_SKIP = 2; // Process 1 in every 3 frames

const PROXY_DEVICES = {
  'cell phone': 0.35,
  'laptop': 0.4,
  'tablet': 0.4, // Custom alias for detection
  'tv': 0.5,
  'remote': 0.3,
  'mouse': 0.3,
  'keyboard': 0.3
};

async function loadModel() {
  if (model) return { success: true, backend: tf.getBackend() };

  const backends = ['webgl', 'cpu'];
  for (const backend of backends) {
    try {
      await tf.setBackend(backend);
      await tf.ready();
      
      model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      
      // Warm-up the model
      const warmUpTensor = tf.zeros([224, 224, 3], 'int32');
      await model.detect(warmUpTensor);
      warmUpTensor.dispose();
      
      console.log(`🤖 AI Model loaded successfully with ${backend} backend.`);
      return { success: true, backend };

    } catch (error) {
      console.warn(`Failed to initialize with ${backend} backend:`, error.message);
    }
  }
  
  return { success: false, backend: null };
}

self.onmessage = async (event) => {
  const { type, imageData, frameNumber } = event.data;

  switch (type) {
    case 'init':
      try {
        const { success, backend } = await loadModel();
        if (success) {
          const memory = tf.memory();
          self.postMessage({ type: 'ready', backend, memory });
        } else {
          throw new Error('All backend initializations failed.');
        }
      } catch (error) {
        self.postMessage({ type: 'error', error: "Failed to load AI model. Your browser might not be supported." });
      }
      break;

    case 'detect':
      frameCounter++;
      if (!model || isDetecting || (frameCounter % (FRAME_SKIP + 1)) !== 0) {
        return;
      }

      isDetecting = true;
      let tensor = null;
      try {
        const detectionStartTime = performance.now();
        
        tensor = tf.browser.fromPixels(imageData);
        
        const predictions = await model.detect(tensor);
        
        const detectionTime = performance.now() - detectionStartTime;
        if (detectionTime > 2000) {
          console.warn(`Slow detection: ${detectionTime.toFixed(0)}ms`);
        }

        const detectedDevices = predictions
          .map(p => ({
            ...p,
            type: p.class.toLowerCase().replace(' ', '')
          }))
          .filter(p => PROXY_DEVICES[p.class] && p.score >= PROXY_DEVICES[p.class])
          .map(p => ({
            type: p.class,
            confidence: p.score,
            area: p.bbox[2] * p.bbox[3]
          }));

        self.postMessage({
          type: 'result',
          isProxyDetected: detectedDevices.length > 0,
          deviceCount: detectedDevices.length,
          devices: detectedDevices,
        });

      } catch (error) {
        console.error('AI detection failed:', error);
        self.postMessage({ type: 'result', isProxyDetected: false, deviceCount: 0, devices: [] });
      } finally {
        if (tensor) tensor.dispose();
        isDetecting = false;
      }
      break;

    case 'cleanup':
      if (model && model.dispose) {
        model.dispose();
      }
      model = null;
      console.log("Worker cleaned up.");
      break;
  }
};

self.onerror = (error) => {
  console.error('Unhandled worker error:', error);
  self.postMessage({ type: 'error', error: 'A critical worker error occurred.' });
};
