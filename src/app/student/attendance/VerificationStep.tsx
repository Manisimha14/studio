// src/app/student/attendance/VerificationStep.tsx

import { useEffect, useRef, useState, useCallback } from 'react';

interface VerificationStepProps {
  onVerified: (snapshot: string, proxyDetected: boolean) => Promise<void>;
  isSubmitting: boolean;
  onBack: () => void;
}

interface DeviceDetection {
  type: string;
  confidence: number;
  area: number;
}

export default function VerificationStep({ onVerified, isSubmitting, onBack }: VerificationStepProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detectorReady, setDetectorReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isProxyDetected, setIsProxyDetected] = useState(false);
  const [systemInfo, setSystemInfo] = useState<any>(null);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('📸 Camera track stopped');
        });
        streamRef.current = null;
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
  }, []);

  const initCamera = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 },
          frameRate: { ideal: 15, max: 30 },
          facingMode: 'user',
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Camera loading timeout')), 10000);
          videoRef.current!.onloadedmetadata = () => {
            clearTimeout(timeout);
            videoRef.current?.play().then(() => {
              setCameraReady(true);
              resolve();
            }).catch(reject);
          };
        });
      }
    } catch (err: any) {
      const errorMessage = err.name === 'NotAllowedError' 
        ? 'Camera permission denied. Please allow camera access and refresh.'
        : err.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : `Camera error: ${err.message}`;
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const initDetector = useCallback(async () => {
    try {
      if (!window.Worker) throw new Error('Web Workers not supported.');

      workerRef.current = new Worker('/detection.worker.js');
      
      workerRef.current.onmessage = (event) => {
        const { type, isProxyDetected: detected, error: workerError, backend } = event.data;
        
        switch (type) {
          case 'ready':
            setDetectorReady(true);
            setSystemInfo({ backend });
            console.log(`🤖 AI Detector ready with ${backend} backend.`);
            break;
          case 'result':
            setIsProxyDetected(detected);
            break;
          case 'error':
            console.error('🚨 AI Worker error:', workerError);
            if (workerError.includes('model')) {
               setError("Failed to load the AI model. This might be a network issue. Please try refreshing.");
            }
            break;
        }
      };

      workerRef.current.onerror = (e) => {
        console.error('💥 Worker script error:', e);
        setError('AI detection system failed to start. Please refresh the page.');
        throw new Error('Worker script failed');
      };

      const readyPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('AI initialization timeout.')), 20000);
        
        const onReady = (event: MessageEvent) => {
          if (event.data.type === 'ready') {
            clearTimeout(timeout);
            workerRef.current?.removeEventListener('message', onReady);
            resolve();
          } else if (event.data.type === 'error') {
            clearTimeout(timeout);
            workerRef.current?.removeEventListener('message', onReady);
            reject(new Error(event.data.error));
          }
        };
        workerRef.current?.addEventListener('message', onReady);
      });

      workerRef.current.postMessage({ type: 'init' });
      await readyPromise;
      
    } catch (err: any) {
      setError(`AI system failed: ${err.message}`);
      throw err;
    }
  }, []);

  const startDetection = useCallback(() => {
    if (!cameraReady || !detectorReady || !workerRef.current || !videoRef.current) return;
    
    const worker = workerRef.current;
    const video = videoRef.current;
    const detectionCanvas = document.createElement('canvas');
    detectionCanvas.width = 224;
    detectionCanvas.height = 224;
    const ctx = detectionCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const detectionInterval = setInterval(() => {
      if (video.readyState < 2 || video.paused) return;
      try {
        ctx.drawImage(video, 0, 0, 224, 224);
        const imageData = ctx.getImageData(0, 0, 224, 224);
        worker.postMessage({ type: 'detect', imageData }, [imageData.data.buffer]);
      } catch (e) {
        console.error("Frame capture error for detection:", e);
      }
    }, 2000);

    detectionIntervalRef.current = detectionInterval;
  }, [cameraReady, detectorReady]);


  const captureSnapshot = async () => {
    if (!videoRef.current || !canvasRef.current || isVerifying || isSubmitting) return;

    setIsVerifying(true);
    
    try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        const snapshot = canvas.toDataURL('image/jpeg', 0.8);
        
        await onVerified(snapshot, isProxyDetected);

    } catch (e) {
        console.error("Snapshot failed:", e);
        setError("Could not capture image. Please try again.");
    } finally {
        setIsVerifying(false);
        stopCameraStream();
    }
  };

  const handleRetry = () => {
    window.location.reload();
  };

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        setIsLoading(true);
        setError(null);
        await Promise.all([initCamera(), initDetector()]);
        if (active) setIsLoading(false);
      } catch (err: any) {
        if (active) setIsLoading(false);
      }
    };
    init();
    return () => { active = false; };
  }, [initCamera, initDetector]);

  useEffect(() => {
    if (cameraReady && detectorReady) {
      startDetection();
    }
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [cameraReady, detectorReady, startDetection]);
  
  useEffect(() => {
    return () => {
        stopCameraStream();
        if (workerRef.current) {
            workerRef.current.terminate();
        }
    }
  }, [stopCameraStream]);

  if (error) {
    const isTimeoutError = error.includes('timeout');
    const isConnectionError = error.includes('network');
    
    return (
      <div className="flex flex-col items-center p-6 text-center max-w-lg mx-auto">
        <div className="text-red-600 mb-6 p-4 bg-red-50 rounded-lg border border-red-200 w-full">
          <div className="text-lg font-semibold mb-2">
            {isTimeoutError ? '⏱️ Loading Timeout' : isConnectionError ? '🌐 Connection Issue' : '⚠️ System Error'}
          </div>
          <div className="text-sm mb-4">{error}</div>
          <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded border-t">
            <div className="font-medium mb-1">💡 Try these solutions:</div>
            <ul className="text-left space-y-1 list-disc list-inside">
              <li>Check your internet connection</li>
              <li>Refresh the page</li>
              <li>Try a different browser or device</li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <button onClick={handleRetry} className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
            ↻ Full Page Refresh
          </button>
          <button onClick={onBack} className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors border rounded-lg">
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <CardHeader>
        <CardTitle className="text-3xl font-bold">Take a Snapshot</CardTitle>
        <CardDescription>
          Position yourself in the frame. The system will verify your environment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isProxyDetected && !isLoading && (
            <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Proxy Device Detected</AlertTitle>
                <AlertDescription>
                A phone or other device was detected. Your submission will be flagged for review.
                </AlertDescription>
            </Alert>
        )}
        <div className="relative aspect-video w-full bg-gray-900 rounded-lg overflow-hidden border">
          <video
            ref={videoRef}
            className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${!isLoading ? 'opacity-100' : 'opacity-0'}`}
            autoPlay
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm rounded-lg">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="font-medium">Initializing Verification System...</p>
              <p className="text-sm text-muted-foreground">Camera: {cameraReady ? '✅' : '⏳'} | AI: {detectorReady ? '✅' : '⏳'}</p>
            </div>
          )}
           {!isLoading && systemInfo?.backend && (
             <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                AI Backend: {systemInfo.backend.toUpperCase()}
             </div>
           )}
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-4">
        <Button
          onClick={captureSnapshot}
          disabled={isLoading || isVerifying || isSubmitting}
          className="w-full py-3 font-semibold"
          size="lg"
        >
          {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing...</> :
           isVerifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> :
           isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> :
           'Capture & Submit'
          }
        </Button>
        <Button 
          variant="ghost" 
          onClick={onBack}
          disabled={isSubmitting || isVerifying}
          className="w-full"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </CardFooter>
    </>
  );
}
