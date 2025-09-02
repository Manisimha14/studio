
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/components/ui/alert";
import {
  Loader2,
  AlertTriangle,
  Camera,
  ArrowLeft,
  CheckCircle,
} from "lucide-react";
import { playSound } from "@/lib/utils";

interface VerificationStepProps {
    onVerified: (snapshot: string, proxyDetected: boolean) => Promise<void>;
    isSubmitting: boolean;
    onBack: () => void;
}

// Optimized for maximum speed
const DETECTION_INTERVAL_MS = 3000; // Very infrequent for performance
const VIDEO_CONSTRAINTS = {
  width: { ideal: 320, max: 480 }, // Much smaller for speed
  height: { ideal: 240, max: 360 },
  facingMode: 'user',
  frameRate: { ideal: 10, max: 15 } // Very low framerate
};

export default function VerificationStep({ onVerified, isSubmitting, onBack }: VerificationStepProps) {
  const [cameraReady, setCameraReady] = useState(false);
  const [detectorReady, setDetectorReady] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isProxyDetected, setIsProxyDetected] = useState(false);
  const [error, setError] = useState("");
  const [cameraProgress, setCameraProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const animationRef = useRef<number>();
  const lastDetectionTime = useRef(0);
  const finalCheckResolver = useRef<((value: boolean) => void) | null>(null);

  // Ultra-fast camera initialization
  const initCamera = useCallback(async () => {
    try {
      setCameraProgress(10);
      
      // Request camera with timeout
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS }),
        new Promise<MediaStream>((_, reject) => 
          setTimeout(() => reject(new Error('Camera timeout')), 8000)
        )
      ]);
      
      setCameraProgress(50);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Fast video ready detection
        const playPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Video timeout')), 5000);
          
          videoRef.current!.addEventListener('canplay', () => {
            clearTimeout(timeout);
            videoRef.current!.play();
            setCameraProgress(100);
            setCameraReady(true);
            resolve();
          }, { once: true });
        });
        
        await playPromise;
      }
    } catch (err: any) {
      console.error('Camera failed:', err);
      setError(err.message || 'Camera access failed');
    }
  }, []);

  // Ultra-fast detector initialization
  const initDetector = useCallback(async () => {
    try {
      workerRef.current = new Worker('/detection.worker.js');
      
      workerRef.current.onmessage = (event) => {
        const { type, isProxyDetected, error } = event.data;
        
        if (type === 'ready') {
          setDetectorReady(true);
        } else if (type === 'error') {
          console.error('Detector failed:', error);
          setError(`Detection failed: ${error}`);
        } else if (type === 'result') {
          if (finalCheckResolver.current) {
            finalCheckResolver.current(isProxyDetected);
            finalCheckResolver.current = null;
          } else {
            setIsProxyDetected(isProxyDetected);
          }
        }
      };

      workerRef.current.onerror = () => {
        setError('Worker script failed to load');
      };

      // Initialize immediately
      workerRef.current.postMessage({ type: 'init' });
      
      // Fallback timeout
      setTimeout(() => {
        if (!detectorReady) {
          setDetectorReady(true); // Allow capture without detection as fallback
          console.warn('Detector timeout - proceeding without detection');
        }
      }, 5000);
      
    } catch (err: any) {
      console.error('Detector init failed:', err);
      setDetectorReady(true); // Proceed without detection
    }
  }, [detectorReady]);

  // Optimized detection loop
  const detectionLoop = useCallback(() => {
    // FIX: Added explicit null check for videoRef.current
    if (cameraReady && detectorReady && videoRef.current && videoRef.current.readyState >= 2 && workerRef.current) {
      const now = performance.now();
      if (now - lastDetectionTime.current > DETECTION_INTERVAL_MS) {
        lastDetectionTime.current = now;
        
        try {
          // Get image data from video for heuristic detection
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 160; // Very small for speed
          canvas.height = 120;
          
          if (ctx && videoRef.current) {
            ctx.drawImage(videoRef.current, 0, 0, 160, 120);
            const imageData = ctx.getImageData(0, 0, 160, 120);
            
            workerRef.current.postMessage({ 
              type: 'detect', 
              imageData: imageData 
            });
          }
        } catch (error) {
          console.error('Detection loop error:', error);
        }
      }
    }
    animationRef.current = requestAnimationFrame(detectionLoop);
  }, [cameraReady, detectorReady]);

  const captureSnapshot = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    playSound?.('capture');
    setIsVerifying(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // High quality capture
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }

      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      let isPhoneDetectedInFinalCheck = false;

      // Quick final check if detector is available
      if (workerRef.current && detectorReady) {
        const smallCanvas = document.createElement('canvas');
        const smallCtx = smallCanvas.getContext('2d');
        smallCanvas.width = 160;
        smallCanvas.height = 120;
        
        if (smallCtx) {
          smallCtx.drawImage(video, 0, 0, 160, 120);
          const imageData = smallCtx.getImageData(0, 0, 160, 120);
          
          workerRef.current.postMessage({ type: 'detect', imageData });

          isPhoneDetectedInFinalCheck = await new Promise<boolean>((resolve) => {
            finalCheckResolver.current = resolve;
            setTimeout(() => {
              if (finalCheckResolver.current === resolve) {
                finalCheckResolver.current = null;
                resolve(false);
              }
            }, 2000); // Quick timeout
          });
        }
      }

      // Always submit, but pass the flag
      await onVerified(dataUrl, isPhoneDetectedInFinalCheck);
      
    } catch (error) {
      console.error("Capture failed:", error);
      setIsVerifying(false);
    }
  };

  // Initialize everything
  useEffect(() => {
    let active = true;
    const init = async () => {
      await initCamera();
      if(active && cameraReady) {
        await initDetector();
      }
    };
    
    init();

    return () => {
      active = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, [initCamera, initDetector, cameraReady]);

  // Start detection when ready
  useEffect(() => {
    if (cameraReady && detectorReady) {
      animationRef.current = requestAnimationFrame(detectionLoop);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [cameraReady, detectorReady, detectionLoop]);

  const retry = () => {
    window.location.reload(); // Clean reset
  };

  const isReady = cameraReady && detectorReady;
  const isDisabled = !isReady || isSubmitting || isVerifying;

  if (error) {
    return (
      <>
        <CardHeader>
          <CardTitle className="text-3xl font-bold">System Error</CardTitle>
          <CardDescription>Unable to access camera or load the system.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>An error occurred</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="text-center py-4">
            <Button onClick={retry} className="gap-2">
              <Camera className="h-4 w-4" />
              Retry
            </Button>
          </div>
        </CardContent>
      </>
    );
  }

  return (
    <>
      <CardHeader>
        <CardTitle className="text-3xl font-bold">Take a Snapshot</CardTitle>
        <CardDescription>
          Position yourself in the frame. AI will verify the image.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isProxyDetected && isReady && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Phone Detected</AlertTitle>
            <AlertDescription>
              Please remove any phones or screens from the frame.
            </AlertDescription>
          </Alert>
        )}

        <div className="relative aspect-video w-full bg-gray-50 rounded-lg overflow-hidden border-2 border-dashed border-gray-200">
          <video
            ref={videoRef}
            className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${
              cameraReady ? 'opacity-100' : 'opacity-0'
            }`}
            autoPlay
            muted
            playsInline
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {!isReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90">
              {cameraReady ? (
                <>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <p className="font-medium text-green-700">Camera Ready</p>
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  <p className="text-sm text-gray-600">Loading detector...</p>
                </>
              ) : (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <p className="font-medium">Starting Camera</p>
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${cameraProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">{cameraProgress}%</p>
                </>
              )}
            </div>
          )}
        </div>

        <Button
          onClick={captureSnapshot}
          disabled={isDisabled}
          className="w-full py-3 font-semibold"
          size="lg"
        >
          {isVerifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : isSubmitting ? (
             <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : !isReady ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Preparing...
            </>
          ) : (
            <>
              <Camera className="mr-2 h-4 w-4" />
              Capture & Submit
            </>
          )}
        </Button>

        {!cameraReady && cameraProgress > 0 && cameraProgress < 100 && (
          <div className="text-center">
            <Button variant="link" onClick={retry} className="text-sm">
              Taking too long? Click to retry
            </Button>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button 
          variant="ghost" 
          onClick={() => { playSound?.('click'); onBack(); }}
          disabled={isSubmitting || isVerifying}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </CardFooter>
    </>
  );
}
