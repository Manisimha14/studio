
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
const CONTINUOUS_DETECTION_INTERVAL_MS = 1500; 
const VIDEO_CONSTRAINTS = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  facingMode: 'user'
};

export default function VerificationStep({ onVerified, isSubmitting, onBack }: VerificationStepProps) {
  const [cameraStatus, setCameraStatus] = useState("initializing");
  const [detectorStatus, setDetectorStatus] = useState("loading");
  const [isProxyDetected, setIsProxyDetected] = useState(false); // For UI warning only
  const [isVerifying, setIsVerifying] = useState(false); // For final check state

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef<number>();
  const lastCheckTime = useRef(0);
  const finalCheckResolver = useRef<((value: boolean) => void) | null>(null);

  // This is now the main capture and verification logic
  const handleCapture = async () => {
    playSound('capture');
    if (!workerRef.current || !videoRef.current || !canvasRef.current) return;

    setIsVerifying(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const targetWidth = 480;
    const scale = targetWidth / video.videoWidth;
    canvas.width = targetWidth;
    canvas.height = video.videoHeight * scale;

    const context = canvas.getContext("2d");
    if (context) {
        // Flip the image horizontally for a mirror effect
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        context.setTransform(1, 0, 0, 1, 0, 0);
    }
    
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    
    const imageBitmap = await createImageBitmap(video);
    workerRef.current.postMessage({ type: 'detect', frame: imageBitmap }, [imageBitmap]);

    const isProxyInFinalCheck = await new Promise<boolean>((resolve) => {
      finalCheckResolver.current = resolve;
    });

    if (isProxyInFinalCheck) {
      playSound('error');
      console.error("Submission failed: A phone was detected in the final snapshot.");
      setIsVerifying(false);
    } else {
      await onVerified(dataUrl);
    }
  };

  // The continuous loop for UI warning
  const continuousPredictionLoop = useCallback(async () => {
    if (cameraStatus === "ready" && detectorStatus === "ready" && workerRef.current && videoRef.current && videoRef.current.readyState >= 3) {
      const now = performance.now();
      if (now - lastCheckTime.current > CONTINUOUS_DETECTION_INTERVAL_MS) {
        lastCheckTime.current = now;
        const imageBitmap = await createImageBitmap(videoRef.current);
        workerRef.current.postMessage({ type: 'detect', frame: imageBitmap }, [imageBitmap]);
      }
    }
    requestRef.current = requestAnimationFrame(continuousPredictionLoop);
  }, [cameraStatus, detectorStatus]);

  // Effect for setup and message handling
  useEffect(() => {
    workerRef.current = new Worker('/detection.worker.js');
    
    workerRef.current.onmessage = (event) => {
      const { type, isProxyDetected, error } = event.data;
      if (type === 'ready') setDetectorStatus("ready");
      else if (type === 'error') {
        console.error("Worker initialization failed:", error);
        setDetectorStatus("failed");
      } else if (type === 'result') {
        if (finalCheckResolver.current) {
          finalCheckResolver.current(isProxyDetected);
          finalCheckResolver.current = null;
        } else {
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
          // **FIX 1: Use oncanplay for reliable ready state**
          videoRef.current.oncanplay = () => {
            videoRef.current?.play();
            setCameraStatus("ready");
          };
        }
      } catch (err) {
        console.error("Camera setup failed:", err);
        setCameraStatus("error");
      }
    };
    setupCamera();
    
    requestRef.current = requestAnimationFrame(continuousPredictionLoop);

    return () => { 
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        workerRef.current?.terminate();
        if (videoRef.current && videoRef.current.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        }
     };
  }, [continuousPredictionLoop]);

  const isButtonDisabled = cameraStatus !== 'ready' || detectorStatus !== 'ready' || isSubmitting || isVerifying;
 
  const renderOverlay = () => {
    const commonClasses = "absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-4 rounded-lg";
    if (isSubmitting || isVerifying) {
         return (
             <div className={`${commonClasses} bg-background/80 backdrop-blur-sm`}>
                 <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                 <p className="text-muted-foreground">{isVerifying ? 'Verifying...' : 'Submitting...'}</p>
             </div>
         );
    }
    
    // **FIX 2: Improved loading messages**
    if (cameraStatus !== 'ready' || (cameraStatus === 'ready' && detectorStatus === 'loading')) {
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
    
    if (cameraStatus === 'error' || detectorStatus === 'failed') {
        const title = detectorStatus === 'failed' ? 'AI Model Failed' : 'Camera Error';
        const description = detectorStatus === 'failed' ? 'The proxy detection model could not be loaded.' : 'Could not start camera. Please check device permissions and try again.';
        return (
          <Alert variant="destructive" className={`${commonClasses} bg-destructive/90 text-destructive-foreground`}>
              <AlertTriangle className="h-10 w-10" />
              <AlertTitle>{title}</AlertTitle>
              <AlertDescription>{description}</AlertDescription>
          </Alert>
        );
    }
    
    return null;
  }

  return (
    <>
      <CardHeader>
        <CardTitle className="text-3xl font-bold">Take a Snapshot</CardTitle>
        <CardDescription>Position yourself in the frame. The final image will be verified.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isProxyDetected && !isVerifying && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Potential Issue Detected</AlertTitle>
              <AlertDescription>
                Please ensure no other screens are visible. The final snapshot will be verified.
              </AlertDescription>
            </Alert>
        )}
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
        <Button 
            onClick={handleCapture} 
            disabled={isButtonDisabled}
            className="w-full py-6 text-lg font-semibold transition-all hover:scale-105 active:scale-100"
        >
            {isVerifying ? (
                <><Loader2 className="mr-2 animate-spin" /> Verifying...</>
            ) : (
                <><Camera className="mr-2" /> Take Snapshot & Submit</>
            )}
        </Button>
      </CardContent>
      <CardFooter>
        <Button variant="link" onClick={() => { playSound('click'); onBack(); }} disabled={isSubmitting || isVerifying}>
             <ArrowLeft className="mr-2" />
             Go Back
        </Button>
      </CardFooter>
    </>
  );
}
