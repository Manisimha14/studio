// public/detection.worker.js

// Import the MediaPipe Vision library from the CDN
self.importScripts("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_bundle.js");

let objectDetector;

// Listen for messages from the main React component
self.onmessage = async (event) => {
  const { type, frame } = event.data;

  // This block runs once to initialize the detector
  if (type === 'init') {
    try {
      const vision = await self.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      objectDetector = await self.ObjectDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `/efficientdet_lite0.task`,
          delegate: "GPU",
        },
        scoreThreshold: 0.55, // Slightly higher threshold can be faster
        runningMode: "VIDEO",
      });
      // Tell the main thread that initialization is complete
      self.postMessage({ type: 'ready' });
    } catch (error) {
      // Inform the main thread if initialization fails
      self.postMessage({ type: 'error', error: error.message });
    }
  } 
  
  // This block runs for each video frame that needs analysis
  else if (type === 'detect' && objectDetector) {
    // MediaPipe's detectForVideo can directly accept an ImageBitmap
    const results = objectDetector.detectForVideo(frame, performance.now());
    
    // Efficiently check for a 'cell phone'
    const phoneDetection = results.detections.some(
      (d) => d.categories[0].categoryName === 'cell phone'
    );
    
    // Send only the final boolean result back to the main thread
    self.postMessage({ type: 'result', isProxyDetected: phoneDetection });

    // Close the ImageBitmap to free up memory immediately
    frame.close();
  }
};
