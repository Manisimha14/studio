// public/detection.worker.js

importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.11.0/dist/tf.min.js");
importScripts("https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2/dist/coco-ssd.min.js");

let model = null;
let isDetecting = false; // OPTIMIZATION: Flag to prevent detection backlog

async function loadModel() {
  if (model) return;

  try {
    // OPTIMIZATION: Set the backend to WebGL for GPU acceleration
    await tf.setBackend('webgl');
    await tf.ready();
    
    // OPTIMIZATION: Load the 'lite_mobilenet_v2' model - smaller and faster
    model = await cocoSsd.load({ 
      base: 'lite_mobilenet_v2'
    });
    
    console.log('AI model loaded successfully with WebGL backend');
  } catch (error) {
    console.error('Failed to load model:', error);
    // Fallback to CPU if WebGL fails
    try {
      await tf.setBackend('cpu');
      model = await cocoSsd.load({ 
        base: 'lite_mobilenet_v2'
      });
      console.log('AI model loaded with CPU backend (fallback)');
    } catch (fallbackError) {
      console.error('Complete model loading failure:', fallbackError);
      throw fallbackError;
    }
  }
}

self.onmessage = async (event) => {
  const { type, frame } = event.data;

  if (type === 'init') {
    try {
      await loadModel();
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({ 
        type: 'error', 
        error: "Failed to load AI model. Please refresh and try again." 
      });
    }
    return;
  }

  if (type === 'detect') {
    // OPTIMIZATION: If the model is busy or not ready, skip this frame
    if (!model || !frame || isDetecting) {
      return;
    }

    isDetecting = true; // Lock detection to prevent backlog
    
    try {
      // Create tensor from image data
      const tensor = tf.browser.fromPixels(frame);
      
      // Run detection
      const predictions = await model.detect(tensor);
      
      // Clean up tensor immediately to prevent memory leaks
      tensor.dispose();

      // Check for proxy devices (phones, tablets, laptops, etc.)
      const proxyDevices = [
        'cell phone',
        'laptop', 
        'tablet',
        'computer',
        'monitor',
        'tv',
        'remote'
      ];
      
      const isProxyDetected = predictions.some(prediction => {
        const isProxyDevice = proxyDevices.includes(prediction.class.toLowerCase());
        const hasHighConfidence = prediction.score > 0.45; // Slightly lower threshold for better detection
        
        if (isProxyDevice && hasHighConfidence) {
          console.log(`Detected ${prediction.class} with confidence ${(prediction.score * 100).toFixed(1)}%`);
        }
        
        return isProxyDevice && hasHighConfidence;
      });
      
      self.postMessage({ 
        type: 'result', 
        isProxyDetected,
        detections: predictions.length // For debugging
      });

    } catch (error) {
      console.error('AI detection failed:', error);
      // Fail safe - assume no proxy detected in case of error
      self.postMessage({ 
        type: 'result', 
        isProxyDetected: false 
      });
    } finally {
      isDetecting = false; // Unlock detection for the next frame
    }
  }
};

// Handle worker errors
self.onerror = (error) => {
  console.error('Worker error:', error);
  self.postMessage({ 
    type: 'error', 
    error: 'AI detection worker encountered an error' 
  });
};
