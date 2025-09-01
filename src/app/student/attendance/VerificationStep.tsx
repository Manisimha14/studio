
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
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
import {
  Loader2,
  VideoOff,
  AlertTriangle,
  RefreshCw,
  Camera,
  ArrowLeft,
} from "lucide-react";
import { playSound } from "@/lib/utils";

interface VerificationStepProps {
    onVerified: (snapshot: string | null) => Promise<void>;
    isSubmitting: boolean;
    onBack: () => void;
}


// --- Final Optimization Configuration ---
const DETECTION_INTERVAL_MS = 750; // Balance responsiveness and performance
const VIDEO_CONSTRAINTS = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  facingMode: 'user'
};

export default function VerificationStep({ onVerified, isSubmitting, onBack }: VerificationStepProps) {
  const [cameraStatus, setCameraStatus] = useState("initializing");
  const [detectorStatus, setDetectorStatus] = useState("loading");
  const [isProxyDetected, setIsProxyDetected] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // For the final snapshot
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null); // For ImageBitmap creation
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef<number>();
  const lastCheckTime = useRef(0);
  const isProxyDetectedRef = useRef(false);

  // The main loop that sends frames to the worker
  const predictWebcam = useCallback(async () => {
    // Ensure everything is ready for detection
    if (cameraStatus === "ready" && detectorStatus === "ready" && workerRef.current && videoRef.current && videoRef.current.readyState >= 3) {
      const now = performance.now();
      if (now - lastCheckTime.current > DETECTION_INTERVAL_MS) {
        lastCheckTime.current = now;

        if (!offscreenCanvasRef.current) {
          offscreenCanvasRef.current = document.createElement('canvas');
          offscreenCanvasRef.current.width = videoRef.current.videoWidth;
          offscreenCanvasRef.current.height = videoRef.current.videoHeight;
        }

        const context = offscreenCanvasRef.current.getContext('2d');
        if (context) {
          context.drawImage(videoRef.current, 0, 0);
          const imageBitmap = await createImageBitmap(offscreenCanvasRef.current);
          
          // Post the bitmap to the worker, transferring ownership (zero-copy)
          workerRef.current.postMessage({ type: 'detect', frame: imageBitmap }, [imageBitmap]);
        }
      }
    }
    requestRef.current = requestAnimationFrame(predictWebcam);
  }, [cameraStatus, detectorStatus]);

  // The main effect for setup and cleanup
  useEffect(() => {
    workerRef.current = new Worker('/detection.worker.js');

    workerRef.current.onmessage = (event) => {
      const { type, isProxyDetected, error } = event.data;
      if (type === 'ready') setDetectorStatus("ready");
      else if (type === 'error') {
        console.error("Worker initialization failed:", error);
        setDetectorStatus("failed");
      } else if (type === 'result') {
        if (isProxyDetectedRef.current !== isProxyDetected) {
          isProxyDetectedRef.current = isProxyDetected;
          setIsProxyDetected(isProxyDetected);
        }
      }
    };
    workerRef.current.postMessage({ type: 'init' });

    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setCameraStatus("ready");
        }
      } catch (err) {
        console.error("Camera setup failed:", err);
        setCameraStatus("error");
      }
    };
    setupCamera();

    requestRef.current = requestAnimationFrame(predictWebcam);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      workerRef.current?.terminate();
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, [predictWebcam]);


  const handleCapture = useCallback(() => {
    playSound('capture');
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const targetWidth = 480;
      const scale = targetWidth / video.videoWidth;
      canvas.width = targetWidth;
      canvas.height = video.videoHeight * scale;

      const context = canvas.getContext("2d");
      if (context) {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        context.setTransform(1, 0, 0, 1, 0, 0);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        onVerified(dataUrl);
      } else {
        onVerified(null);
      }
    } else {
      onVerified(null);
    }
  }, [onVerified]);
  
  const renderOverlay = () => {
    const commonClasses = "absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-4 rounded-lg";
    if (isSubmitting) {
         return (
             <div className={`${commonClasses} bg-background/80 backdrop-blur-sm`}>
                 <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                 <p className="text-muted-foreground">Submitting...</p>
             </div>
         );
    }
    
    if (cameraStatus !== 'ready' || detectorStatus !== 'ready') {
        const message = cameraStatus !== 'ready' 
            ? 'Initializing Camera...' 
            : 'Loading AI Model...';

        return (
            <div className={`${commonClasses} bg-background/80`}>
                <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                <p className="text-muted-foreground animate-pulse">{message}</p>
            </div>
        );
    }
    
    if (cameraStatus === 'error') {
        return (
          <Alert variant="destructive" className={`${commonClasses} bg-destructive/90 text-destructive-foreground`}>
              <AlertTriangle className="h-10 w-10" />
              <AlertTitle>Camera Error</AlertTitle>
              <AlertDescription>Could not start camera. Please check device permissions and try again.</AlertDescription>
          </Alert>
        );
    }
    
    return null;
  }

  const isButtonDisabled = cameraStatus !== 'ready' || detectorStatus !== 'ready' || isSubmitting || isProxyDetected;

  return (
    <>
      <CardHeader>
        <CardTitle className="text-3xl font-bold">Take a Snapshot</CardTitle>
        <CardDescription>Position yourself in the frame and take a picture.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border-2 border-dashed bg-muted">
            <video
                ref={videoRef}
                className={`h-full w-full object-cover scale-x-[-1] transition-opacity duration-300 ${cameraStatus === 'ready' ? 'opacity-100' : 'opacity-0'}`}
                autoPlay
                muted
                playsInline
            />
            <canvas ref={canvasRef} className="hidden" />
            {renderOverlay()}
        </div>
        {isProxyDetected && (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Proxy Detected</AlertTitle>
                <AlertDescription>
                   A phone was detected in the video feed. Please remove it to continue.
                </AlertDescription>
            </Alert>
        )}
        <Button 
            onClick={handleCapture} 
            disabled={isButtonDisabled}
            className="w-full py-6 text-lg font-semibold transition-all hover:scale-105 active:scale-100"
        >
            <Camera className="mr-2"/>
            Take Snapshot & Submit
        </Button>
      </CardContent>
      <CardFooter>
        <Button variant="link" onClick={() => { playSound('click'); onBack(); }} disabled={isSubmitting}>
             <ArrowLeft className="mr-2" />
             Go Back
        </Button>
      </CardFooter>
    </>
  );
}
