
// public/detection.worker.js

// Load scripts locally from your 'public' folder.
try {
  self.importScripts('/models/tf.min.js');
  self.importScripts('/models/coco-ssd.min.js');
} catch (e) {
  self.postMessage({ type: 'error', error: 'Failed to load core AI scripts.', critical: true });
}

let model = null;
let canvas = null; // This will be an OffscreenCanvas.
let ctx = null;

async function loadModel() {
  if (model) return;
  await tf.ready(); // Automatically finds and prepares the best backend.
  model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
}

self.onmessage = async (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'init':
      try {
        // The payload now contains the OffscreenCanvas.
        canvas = payload.canvas;
        ctx = canvas.getContext('2d', { alpha: false });
        await loadModel();
        self.postMessage({ type: 'ready', backend: tf.getBackend() });
      } catch (error) {
        self.postMessage({ type: 'error', error: error.message, critical: true });
      }
      break;

    case 'detect':
      if (!model || !ctx || !payload.bitmap) {
        // If not ready, signal back to main thread to send next frame
        if (payload.bitmap) payload.bitmap.close();
        self.postMessage({ type: 'result', devices: [] });
        return;
      }
      
      try {
        const bitmap = payload.bitmap;
        // All drawing happens here, off the main thread.
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        const predictions = await model.detect(imageData);
        
        // Free up memory from the bitmap
        bitmap.close(); 

        const devices = predictions
          .filter(p => p.class === 'cell phone' && p.score > 0.50)
          .map(p => ({ type: p.class, confidence: p.score }));

        self.postMessage({
          type: 'result',
          devices: devices
        });

      } catch (error) {
        console.error('Detection error:', error);
        if (payload.bitmap) payload.bitmap.close();
        self.postMessage({ type: 'result', devices: [] });
      }
      break;
  }
};
