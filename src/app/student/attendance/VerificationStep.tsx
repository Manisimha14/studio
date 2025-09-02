
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
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
  const [cameraStatus, setCameraStatus] = useState<"initializing" | "ready" | "error">("initializing");
  const [detectorStatus, setDetectorStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [isProxyDetected, setIsProxyDetected] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [initializationStep, setInitializationStep] = useState<"camera" | "model" | "complete">("camera");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef<number>();
  const lastCheckTime = useRef(0);
  const finalCheckResolver = useRef<((value: boolean) => void) | null>(null);

  const handleCapture = async () => {
    playSound('capture');
    if (!workerRef.current || !videoRef.current || !canvasRef.current) return;

    setIsVerifying(true);

    try {
      // 1. Draw current video frame to main canvas for high-quality snapshot
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
      }
     
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
     
      // 2. Perform a final, high-confidence check
      const imageBitmap = await createImageBitmap(video);
      workerRef.current.postMessage({ type: 'detect', frame: imageBitmap }, [imageBitmap]);

      const isProxyInFinalCheck = await new Promise<boolean>((resolve) => {
        finalCheckResolver.current = resolve;
      });

      // 3. Submit or reject based on the final check
      if (isProxyInFinalCheck) {
        playSound('error');
        console.error("Submission failed: A phone was detected in the final snapshot.");
        setIsVerifying(false);
      } else {
        await onVerified(dataUrl);
      }
    } catch (error) {
      console.error("Capture failed:", error);
      setIsVerifying(false);
    }
  };

  const continuousPredictionLoop = useCallback(async () => {
    if (cameraStatus === "ready" && detectorStatus === "ready" && workerRef.current && videoRef.current && videoRef.current.readyState >= 3) {
      const now = performance.now();
      if (now - lastCheckTime.current > CONTINUOUS_DETECTION_INTERVAL_MS) {
        lastCheckTime.current = now;
        try {
          const imageBitmap = await createImageBitmap(videoRef.current);
          workerRef.current.postMessage({ type: 'detect', frame: imageBitmap }, [imageBitmap]);
        } catch (error) {
          console.error("Continuous detection failed:", error);
        }
      }
    }
    requestRef.current = requestAnimationFrame(continuousPredictionLoop);
  }, [cameraStatus, detectorStatus]);

  // Sequential initialization
  useEffect(() => {
    const initializeSequentially = async () => {
      try {
        // Step 1: Initialize Camera
        setInitializationStep("camera");
        setCameraStatus("initializing");
        
        const stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          await new Promise<void>((resolve) => {
            videoRef.current!.onloadedmetadata = () => {
              videoRef.current?.play();
              setCameraStatus("ready");
              resolve();
            };
          });
        }

        // Step 2: Initialize AI Model
        setInitializationStep("model");
        setDetectorStatus("loading");

        // Create and initialize worker
        workerRef.current = new Worker('/detection.worker.js');
        
        // Set up message handler
        workerRef.current.onmessage = (event) => {
          const { type, isProxyDetected, error } = event.data;
          
          if (type === 'ready') {
            setDetectorStatus("ready");
            setInitializationStep("complete");
          } else if (type === 'error') {
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

        // Initialize the worker
        workerRef.current.postMessage({ type: 'init' });

      } catch (error) {
        console.error("Initialization failed:", error);
        setCameraStatus("error");
        setDetectorStatus("failed");
      }
    };

    initializeSequentially();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Start continuous detection once everything is ready
  useEffect(() => {
    if (cameraStatus === "ready" && detectorStatus === "ready") {
      requestRef.current = requestAnimationFrame(continuousPredictionLoop);
    }
    
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [cameraStatus, detectorStatus, continuousPredictionLoop]);

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
   
    if (initializationStep === "camera" && cameraStatus !== 'ready') {
      return (
        <div className={`${commonClasses} bg-background/80`}>
          <Loader2 className="h-8 w-8 animate-spin text-primary"/>
          <p className="text-muted-foreground animate-pulse">Initializing Camera...</p>
        </div>
      );
    }

    if (initializationStep === "model" && detectorStatus === 'loading') {
      return (
        <div className={`${commonClasses} bg-background/80`}>
          <Loader2 className="h-8 w-8 animate-spin text-primary"/>
          <p className="text-muted-foreground animate-pulse">Loading AI Model...</p>
          <p className="text-xs text-muted-foreground">This may take a moment...</p>
        </div>
      );
    }
   
    if (cameraStatus === 'error' || detectorStatus === 'failed') {
      const title = detectorStatus === 'failed' ? 'AI Model Failed' : 'Camera Error';
      const description = detectorStatus === 'failed' 
        ? 'The detection model could not be loaded. Please refresh and try again.' 
        : 'Could not access camera. Please check permissions and try again.';
        
      return (
        <div className={`${commonClasses} bg-destructive/90 text-destructive-foreground`}>
          <AlertTriangle className="h-10 w-10" />
          <div className="space-y-2">
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm">{description}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.location.reload()}
              className="mt-2"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Page
            </Button>
          </div>
        </div>
      );
    }
   
    return null;
  };

  const getStatusMessage = () => {
    if (initializationStep === "complete") return "Ready to capture";
    if (initializationStep === "model") return "Loading AI detection model...";
    if (initializationStep === "camera") return "Initializing camera...";
    return "Preparing...";
  };

  return (
    <>
      <CardHeader>
        <CardTitle className="text-3xl font-bold">Take a Snapshot</CardTitle>
        <CardDescription>
          Position yourself in the frame. The final image will be verified.
          <br />
          <span className="text-sm text-muted-foreground">{getStatusMessage()}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isProxyDetected && !isVerifying && initializationStep === "complete" && (
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
                className={`h-full w-full object-cover scale-x-[-1] transition-opacity duration-500 ${
                  cameraStatus === 'ready' && initializationStep !== "camera" ? 'opacity-100' : 'opacity-0'
                }`}
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
            ) : isButtonDisabled ? (
                <><Loader2 className="mr-2 animate-spin" /> {getStatusMessage()}</>
            ) : (
                <><Camera className="mr-2" /> Take Snapshot & Submit</>
            )}
        </Button>
      </CardContent>
      <CardFooter>
        <Button 
          variant="link" 
          onClick={() => { playSound('click'); onBack(); }} 
          disabled={isSubmitting || isVerifying}
        >
          <ArrowLeft className="mr-2" />
          Go Back
        </Button>
      </CardFooter>
    </>
  );
}
