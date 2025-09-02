
// src/app/student/attendance/VerificationStep.tsx

import { useEffect, useRef, useState, useCallback } from 'react';

interface VerificationStepProps {
  onVerificationComplete: (success: boolean) => void;
}

interface DeviceDetection {
  type: string;
  confidence: number;
  area: number;
}

export default function VerificationStep({ onVerificationComplete }: VerificationStepProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const consecutiveDetectionsRef = useRef(0);

  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detectorReady, setDetectorReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [detectionState, setDetectionState] = useState({
    isProxyDetected: false,
    deviceCount: 0,
    devices: [] as DeviceDetection[],
    confidence: 0
  });
  const [systemInfo, setSystemInfo] = useState<any>(null);

  // Enhanced camera initialization with better mobile support
  const initCamera = useCallback(async () => {
    try {
      // Request high-quality camera with mobile optimization
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 },
          frameRate: { ideal: 15, max: 30 }, // Optimize for battery
          facingMode: 'user',
          // Additional mobile optimizations
          aspectRatio: { ideal: 4/3 },
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Enhanced video loading with timeout
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Camera loading timeout'));
          }, 10000);
          
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              clearTimeout(timeout);
              videoRef.current?.play().then(() => {
                setCameraReady(true);
                resolve();
              }).catch(reject);
            };
            videoRef.current.onerror = () => {
              clearTimeout(timeout);
              reject(new Error('Video loading failed'));
            };
          }
        });
      }
    } catch (err: any) {
      console.error('📸 Camera initialization failed:', err);
      const errorMessage = err.name === 'NotAllowedError' 
        ? 'Camera permission denied. Please allow camera access and refresh.'
        : err.name === 'NotFoundError'
        ? 'No camera found. Please ensure your device has a camera.'
        : `Camera error: ${err.message}`;
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Enhanced AI detector initialization
  const initDetector = useCallback(async () => {
    try {
      // Check if Worker is supported
      if (!window.Worker) {
        throw new Error('Web Workers not supported');
      }

      workerRef.current = new Worker('/detection.worker.js');
      
      workerRef.current.onmessage = (event) => {
        const { type, isProxyDetected, deviceCount, devices, backend, memoryUsage, error } = event.data;
        
        switch (type) {
          case 'ready':
            setDetectorReady(true);
            setSystemInfo({ backend, memory: event.data.memory });
            console.log('🤖 AI Detector ready with backend:', backend);
            break;
            
          case 'result':
            // Implement consecutive detection logic for stability
            if (isProxyDetected) {
              consecutiveDetectionsRef.current++;
            } else {
              consecutiveDetectionsRef.current = Math.max(0, consecutiveDetectionsRef.current - 1);
            }
            
            // Only trigger detection after 2 consecutive positive detections
            const isStableDetection = consecutiveDetectionsRef.current >= 2;
            const maxConfidence = devices?.length > 0 ? Math.max(...devices.map((d: DeviceDetection) => d.confidence)) : 0;
            
            setDetectionState({
              isProxyDetected: isStableDetection,
              deviceCount: deviceCount || 0,
              devices: devices || [],
              confidence: maxConfidence
            });
            break;
            
          case 'error':
            console.error('🚨 AI Worker error:', error);
            setError(error);
            break;
        }
      };

      workerRef.current.onerror = (error) => {
        console.error('💥 Worker error:', error);
        setError('AI detection system failed to initialize');
      };

      // Initialize with timeout
      const initPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('AI initialization timeout'));
        }, 15000);

        const originalOnMessage = workerRef.current!.onmessage;
        workerRef.current!.onmessage = (event) => {
          if (event.data.type === 'ready') {
            clearTimeout(timeout);
            resolve();
          }
          if(originalOnMessage) {
            originalOnMessage.call(workerRef.current, event);
          }
        };
      });

      workerRef.current.postMessage({ type: 'init' });
      await initPromise;
      
    } catch (err: any) {
      console.error('🤖 AI Detector initialization failed:', err);
      setError(`AI initialization failed: ${err.message}`);
      throw err;
    }
  }, []);

  // Optimized detection loop with adaptive frame rate
  const startDetection = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !workerRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    
    if (!context) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    let frameCount = 0;
    const targetFPS = 2; // Process 2 frames per second for optimal performance
    const interval = 1000 / targetFPS;

    detectionIntervalRef.current = setInterval(() => {
      if (video.readyState === video.HAVE_ENOUGH_DATA && !video.paused) {
        try {
          // Draw current frame
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          
          // Send to worker (non-blocking)
          workerRef.current?.postMessage({
            type: 'detect',
            imageData,
            frameNumber: frameCount++
          });
          
        } catch (err) {
          console.error('Frame capture error:', err);
        }
      }
    }, interval);

    console.log(`🎯 Detection started at ${targetFPS} FPS`);
  }, []);

  // Main initialization effect
  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('🚀 Starting parallel initialization...');
        
        // Parallel initialization for maximum speed
        const startTime = performance.now();
        await Promise.all([initCamera(), initDetector()]);
        const endTime = performance.now();
        
        console.log(`✅ Initialization completed in ${(endTime - startTime).toFixed(0)}ms`);
        
        if (active) {
          setIsLoading(false);
        }
      } catch (err: any) {
        if (active) {
          setIsLoading(false);
          console.error('❌ Initialization failed:', err);
        }
      }
    };
    
    init();

    // Cleanup function
    return () => {
      active = false;
      
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'cleanup' });
        workerRef.current.terminate();
        workerRef.current = null;
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('📸 Camera track stopped');
        });
      }
    };
  }, [initCamera, initDetector]);

  // Start detection when both systems are ready
  useEffect(() => {
    if (cameraReady && detectorReady && !detectionIntervalRef.current) {
      startDetection();
    }
  }, [cameraReady, detectorReady, startDetection]);

  // Enhanced capture handler
  const handleCaptureSubmit = useCallback(() => {
    if (detectionState.isProxyDetected) {
      const deviceTypes = detectionState.devices.map(d => d.type).join(', ');
      setError(`🚨 Unauthorized devices detected: ${deviceTypes}. Please remove all electronic devices from the camera view.`);
      
      // Reset detection counter
      consecutiveDetectionsRef.current = 0;
      return;
    }
    
    console.log('✅ Verification successful - no proxy devices detected');
    onVerificationComplete(true);
  }, [detectionState, onVerificationComplete]);

  // Error state rendering
  if (error) {
    return (
      <div className="flex flex-col items-center p-8 text-center max-w-md mx-auto">
        <div className="text-red-600 mb-6 p-4 bg-red-50 rounded-lg border">
          <div className="text-lg font-semibold mb-2">⚠️ System Error</div>
          <div className="text-sm">{error}</div>
        </div>
        <div className="space-y-3 w-full">
          <button 
            onClick={() => {
              setError(null);
              window.location.reload();
            }}
            className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            🔄 Retry Initialization
          </button>
          <button 
            onClick={() => window.history.back()}
            className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="w-full mb-6">
        <button 
          onClick={() => window.history.back()}
          className="flex items-center text-gray-600 hover:text-gray-800 mb-4 transition-colors"
        >
          ← Back
        </button>
        
        <div className="text-right">
          <span className="text-blue-600 font-semibold">Smart Uniworld 1</span>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md border">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">AI Verification</h2>
        <p className="text-gray-600 mb-6">Position yourself in the frame. The system will verify your environment for unauthorized devices.</p>
        
        {/* Video Feed */}
        <div className="relative mb-6">
          <video
            ref={videoRef}
            className="w-full h-64 bg-black rounded-lg object-cover"
            autoPlay
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="hidden"
          />
          
          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 rounded-lg">
              <div className="text-white text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-3"></div>
                <div className="font-medium">Initializing Systems...</div>
                <div className="text-sm mt-1 opacity-80">
                  Camera: {cameraReady ? '✅' : '⏳'} | AI: {detectorReady ? '✅' : '⏳'}
                </div>
              </div>
            </div>
          )}
          
          {/* Detection Status Overlays */}
          {!isLoading && (
            <>
              {detectionState.isProxyDetected ? (
                <div className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium animate-pulse">
                  🚨 Device Detected ({detectionState.deviceCount})
                </div>
              ) : cameraReady && detectorReady ? (
                <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  ✅ Monitoring Active
                </div>
              ) : null}
              
              {/* System Info (Debug) */}
              {systemInfo && (
                <div className="absolute bottom-3 left-3 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                  {systemInfo.backend?.toUpperCase()}
                </div>
              )}
            </>
          )}
        </div>

        {/* Device Detection Info */}
        {detectionState.devices.length > 0 && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="text-sm font-medium text-orange-800 mb-1">Detected Devices:</div>
            {detectionState.devices.slice(0, 3).map((device, idx) => (
              <div key={idx} className="text-xs text-orange-700">
                • {device.type} ({(device.confidence * 100).toFixed(1)}% confidence)
              </div>
            ))}
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleCaptureSubmit}
          disabled={!cameraReady || !detectorReady || isLoading}
          className={`w-full py-3 rounded-lg font-medium transition-all duration-200 ${
            cameraReady && detectorReady && !isLoading
              ? detectionState.isProxyDetected
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white hover:shadow-lg'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isLoading ? '⏳ Initializing...' : 
           detectionState.isProxyDetected ? '🚨 Remove Devices First' : '✅ Submit Attendance'}
        </button>
        
        {/* Status Bar */}
        <div className="mt-4 text-center text-xs text-gray-500">
          {cameraReady && detectorReady ? 
            `🤖 AI Detection Active • ${detectionState.deviceCount} devices tracked` :
            'Preparing verification system...'
          }
        </div>
      </div>
    </div>
  );
}
