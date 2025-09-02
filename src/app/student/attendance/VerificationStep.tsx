
"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/components/ui/alert";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { playSound } from "@/lib/utils";

interface DeviceDetection {
  type: string;
  confidence: number;
}

interface VerificationStepProps {
  onVerified: (snapshot: string, proxyDetected: boolean) => Promise<void>;
  isSubmitting: boolean;
  onBack: () => void;
}

export default function VerificationStep({ onVerified, isSubmitting, onBack }: VerificationStepProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionLoopRef = useRef<number>();
  
  const detectionBuffer = useRef({ positives: 0, negatives: 0 });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detectorReady, setDetectorReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [detectedDevices, setDetectedDevices] = useState<DeviceDetection[]>([]);
  const [isProxyVisible, setIsProxyVisible] = useState(false);
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
    if (detectionLoopRef.current) {
      cancelAnimationFrame(detectionLoopRef.current);
      detectionLoopRef.current = undefined;
    }
  }, []);

  const initCamera = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15 },
          facingMode: 'user',
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const video = videoRef.current;

      if (video) {
        streamRef.current = stream;
        video.muted = true;
        video.playsInline = true;
        
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Camera loading timeout')), 10000);
          video.oncanplay = () => {
            clearTimeout(timeout);
            video.play()
              .then(() => {
                setCameraReady(true);
                resolve();
              })
              .catch(err => {
                console.error("Video play() failed:", err);
                reject(err);
              });
          };
          video.onerror = () => {
             clearTimeout(timeout);
             reject(new Error('Video element encountered an error'));
          };
          video.srcObject = stream;
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

  const initDetector = useCallback(async () => {
    try {
      workerRef.current = new Worker('/detection.worker.js');
      
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const offscreenCanvas = canvas.transferControlToOffscreen();

      const initPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('AI initialization timeout')), 60000);
        
        workerRef.current!.onmessage = (event) => {
          const { type, error: workerError, backend } = event.data;
          if (type === 'ready') {
            clearTimeout(timeout);
            setSystemInfo({ backend });
            setDetectorReady(true);
            resolve();
          } else if (type === 'error') {
            clearTimeout(timeout);
            reject(new Error(workerError));
          }
        };

        workerRef.current!.postMessage(
          { type: 'init', payload: { canvas: offscreenCanvas } },
          [offscreenCanvas]
        );
      });
      await initPromise;

    } catch (err: any) {
      setError(`AI system failed: ${err.message}`);
      throw err;
    }
  }, []);

  const startDetectionLoop = useCallback(() => {
    const processFrame = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2 || !workerRef.current) {
        detectionLoopRef.current = requestAnimationFrame(processFrame);
        return;
      }
      try {
        const bitmap = await createImageBitmap(videoRef.current);
        workerRef.current?.postMessage({ type: 'detect', payload: { bitmap } }, [bitmap]);
      } catch (e) {
        console.error("Failed to create ImageBitmap.", e);
        detectionLoopRef.current = requestAnimationFrame(processFrame);
      }
    };
    detectionLoopRef.current = requestAnimationFrame(processFrame);
  }, []);

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
    return () => { 
        active = false; 
        stopCameraStream();
        if (workerRef.current) {
            workerRef.current.terminate();
        }
    };
  }, [initCamera, initDetector, stopCameraStream]);


  useEffect(() => {
    if (cameraReady && detectorReady) {
      startDetectionLoop();
    }
    
    if (workerRef.current) {
      workerRef.current.onmessage = (event) => {
        const { type, devices } = event.data;
        if (type === 'result') {
          if (devices && devices.length > 0) {
            detectionBuffer.current.positives++;
            detectionBuffer.current.negatives = 0;
          } else {
            detectionBuffer.current.negatives++;
            detectionBuffer.current.positives = 0;
          }
          if (detectionBuffer.current.positives >= 2) {
            setIsProxyVisible(true);
            setDetectedDevices(devices);
          }
          if (detectionBuffer.current.negatives >= 5) {
            setIsProxyVisible(false);
          }
          detectionLoopRef.current = requestAnimationFrame(startDetectionLoop);
        } else if (type === 'ready') {
            setDetectorReady(true);
            setSystemInfo({ backend: event.data.backend });
        }
      };
    }
    
    return () => {
      if (detectionLoopRef.current) {
        cancelAnimationFrame(detectionLoopRef.current);
      }
    };
  }, [cameraReady, detectorReady, startDetectionLoop]);


  const captureSnapshot = async () => {
    if (!videoRef.current || isSubmitting) return;

    playSound('capture');
    
    const finalProxyCheck = isProxyVisible;
    
    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    const snapshot = canvas.toDataURL('image/jpeg', 0.8);
    
    await onVerified(snapshot, finalProxyCheck);
    stopCameraStream();
  };

  const handleRetry = () => { window.location.reload(); };

  if (error) {
    return (
      <div className="flex flex-col items-center p-6 text-center max-w-lg mx-auto">
        <div className="text-red-600 mb-6 p-4 bg-red-50 rounded-lg border border-red-200 w-full">
          <div className="text-lg font-semibold mb-2">⚠️ System Error</div>
          <div className="text-sm mb-4">{error}</div>
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
        {isProxyVisible && !isLoading && (
            <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Proxy Device Detected</AlertTitle>
                <AlertDescription>
                 {detectedDevices.map(d => d.type).join(', ')} detected. Your submission will be flagged.
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
          disabled={isLoading || isSubmitting}
          className="w-full py-3 font-semibold"
          size="lg"
        >
          {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing...</> :
           isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> :
           'Capture & Submit'
          }
        </Button>
        <Button 
          variant="ghost" 
          onClick={onBack}
          disabled={isSubmitting}
          className="w-full"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </CardFooter>
    </>
  );
}
