// Import TensorFlow.js and the COCO-SSD model
self.importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js');
self.importScripts('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');

let modelPromise;

const loadModel = async () => {
    try {
        // Configure TensorFlow.js to use the WebGL backend for GPU acceleration
        await self.tf.setBackend('webgl');
        await self.tf.ready();
        
        // Load the COCO-SSD model. `lite_mobilenet_v2` is small and fast.
        return await self.cocoSsd.load({ modelUrl: 'https://tfhub.dev/tensorflow/tfjs-model/ssd_mobilenet_v2/1/default/1', fromTFHub: true });
    } catch (error) {
        console.warn("WebGL backend failed to initialize, falling back to CPU.", error);
        // Fallback to the CPU backend if WebGL is not available
        await self.tf.setBackend('cpu');
        await self.tf.ready();
        return await self.cocoSsd.load({ modelUrl: 'https://tfhub.dev/tensorflow/tfjs-model/ssd_mobilenet_v2/1/default/1', fromTFHub: true });
    }
};

self.onmessage = async (event) => {
    const { type, frame } = event.data;

    if (type === 'init') {
        if (!modelPromise) {
            modelPromise = loadModel();
        }
        try {
            await modelPromise;
            // Send ready message once the model is loaded
            self.postMessage({ type: 'ready' });
        } catch (error) {
            console.error("Model loading failed:", error);
            self.postMessage({ type: 'error', error: error.message });
        }
    } else if (type === 'detect' && frame) {
        try {
            const model = await modelPromise;
            if (!model) {
                // If model is not ready, do nothing.
                return;
            }
            // Perform object detection
            const predictions = await model.detect(frame, 10, 0.6); // Max 10 objects, 0.6 confidence

            // Check if a 'cell phone' was detected
            const isProxyDetected = predictions.some(p => p.class === 'cell phone');

            // Send the result back to the main thread
            self.postMessage({ type: 'result', isProxyDetected });
        } catch (error) {
            console.error("Detection failed:", error);
        } finally {
            // Close the ImageBitmap to free up memory
            frame.close();
        }
    }
};
