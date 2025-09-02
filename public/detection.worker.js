
// public/detection.worker.js

importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.11.0/dist/tf.min.js");
importScripts("https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2/dist/coco-ssd.min.js");

let model = null;
let isDetecting = false; // OPTIMIZATION: Flag to prevent detection backlog.

async function loadModel() {
  if (model) return;

  // OPTIMIZATION: Set the backend to WebGL for GPU acceleration.
  await tf.setBackend('webgl');
  
  // OPTIMIZATION: Load the 'lite_mobilenet_v2' model, which is smaller and faster.
  model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
}

self.onmessage = async (event) => {
  const { type, imageData, frame } = event.data;

  if (type === 'init') {
    try {
      await loadModel();
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({ type: 'error', error: "Failed to load AI model." });
    }
    return;
  }

  if (type === 'detect') {
    const pixels = imageData || frame;
    // OPTIMIZATION: If the model is busy, skip this frame.
    if (!model || !pixels || isDetecting) {
      return;
    }

    isDetecting = true; // Lock detection
    try {
      // TensorFlow.js works with various pixel sources, including ImageData and ImageBitmap
      const tensor = tf.browser.fromPixels(pixels);
      const predictions = await model.detect(tensor);
      tensor.dispose();

      const isPhoneDetected = predictions.some(
        (prediction) => prediction.class === 'cell phone' && prediction.score > 0.50
      );
      
      self.postMessage({ type: 'result', isProxyDetected: isPhoneDetected });

    } catch (error) {
      console.error('AI detection failed:', error);
      // Fail safe in case of an error
      self.postMessage({ type: 'result', isProxyDetected: false });
    } finally {
      isDetecting = false; // Unlock detection for the next frame
    }
  }
};
