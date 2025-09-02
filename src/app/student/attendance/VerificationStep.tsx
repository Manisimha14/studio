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

// Optimized configuration for speed
const DETECTION_INTERVAL_MS = 2000; // Less frequent = better performance
const VIDEO_CONSTRAINTS = {
  width: { ideal: 480, max: 640 }, // Smaller resolution = faster processing
  height: { ideal: 360, max: 480 },
  facingMode: 'user',
  frameRate: { ideal: 15, max: 30 } // Lower framerate = better performance
};

export default function VerificationStep({ onVerified, isSubmitting, onBack }: VerificationStepProps) {
  const [status, setStatus] = useState<"camera" | "model" | "ready" | "error">("camera");
  const [isProxyDetected, setIsProxyDetected] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const animationRef = useRef<number>();
  const lastDetectionTime = useRef(0);
  const finalCheckResolver = useRef<((value: boolean) => void) | null>(null);

  const captureSnapshot = async () => {
    if (!videoRef.current || !canvasRef.current || !workerRef.current) return;

    playSound?.('capture');
    setIsVerifying(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Optimize canvas size for speed
      const width = 320; // Smaller for faster processing
      const height = (video.videoHeight / video.videoWidth) * width;
      
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d", { alpha: false }); // Disable alpha for performance
      if (ctx) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, width, height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }

      const dataUrl = canvas.toDataURL("image/jpeg", 0.7); // Lower quality for speed

      // Final verification
      const bitmap = await createImageBitmap(video, { resizeWidth: 224, resizeHeight: 224 }); // Smaller for detection
      workerRef.current.postMessage({ type: 'detect', frame: bitmap }, [bitmap]);

      const isPhoneDetected = await new Promise<boolean>((resolve) => {
        finalCheckResolver.current = resolve;
        setTimeout(() => {
          if (finalCheckResolver.current === resolve) {
            finalCheckResolver.current = null;
            resolve(false); // Timeout fallback
          }
        }, 3000);
      });

      if (isPhoneDetected) {
        playSound?.('error');
        setIsVerifying(false);
        return;
      }

      await onVerified(dataUrl);
    } catch (error) {
      console.error("Capture failed:", error);
      setIsVerifying(false);
    }
  };

  const runDetection = useCallback(async () => {
    if (status === "ready" && videoRef.current?.readyState >= 3 && workerRef.current) {
      const now = performance.now();
      if (now - lastDetectionTime.current > DETECTION_INTERVAL_MS) {
        lastDetectionTime.current = now;
        
        try {
          // Use smaller bitmap for continuous detection
          const bitmap = await createImageBitmap(videoRef.current, { 
            resizeWidth: 224, 
            resizeHeight: 224 
          });
          workerRef.current.postMessage({ type: 'detect', frame: bitmap }, [bitmap]);
        } catch (error) {
          console.error("Detection failed:", error);
        }
      }
    }
    animationRef.current = requestAnimationFrame(runDetection);
  }, [status]);

  const initializeSystem = useCallback(async () => {
    try {
      // Phase 1: Camera (fast)
      setStatus("camera");
      setProgress(10);
      
      const stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS });
      
      if (!videoRef.current) return;
      
      videoRef.current.srcObject = stream;
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Camera timeout')), 8000);
        
        videoRef.current!.addEventListener('loadedmetadata', () => {
          clearTimeout(timeout);
          videoRef.current!.play();
          setProgress(40);
          resolve();
        }, { once: true });
      });

      // Phase 2: AI Model (optimized)
      setStatus("model");
      setProgress(50);

      workerRef.current = new Worker('/detection.worker.js');
      
      workerRef.current.onmessage = (event) => {
        const { type, isProxyDetected, error } = event.data;
        
        if (type === 'ready') {
          setProgress(100);
          setStatus("ready");
        } else if (type === 'error') {
          setErrorMsg(error);
          setStatus("error");
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
        setErrorMsg("Worker script failed to load");
        setStatus("error");
      };

      // Progress simulation during model loading
      const progressInterval = setInterval(() => {
        setProgress(prev => prev < 90 ? prev + 5 : prev);
      }, 500);

      setTimeout(() => clearInterval(progressInterval), 8000);

      workerRef.current.postMessage({ type: 'init' });

      // Fallback timeout
      setTimeout(() => {
        if (status !== "ready" && status !== "error") {
          setErrorMsg("Initialization timeout - please try again");
          setStatus("error");
        }
      }, 15000);

    } catch (error: any) {
      console.error("Initialization failed:", error);
      setErrorMsg(error.message);
      setStatus("error");
    }
  }, [status]);

  // Initialize on mount
  useEffect(() => {
    initializeSystem();
    
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, [initializeSystem]);

  // Start detection loop when ready
  useEffect(() => {
    if (status === "ready") {
      animationRef.current = requestAnimationFrame(runDetection);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [status, runDetection]);

  const retry = () => {
    setStatus("camera");
    setProgress(0);
    setErrorMsg("");
    setIsProxyDetected(false);
    initializeSystem();
  };

  const renderContent = () => {
    if (status === "error") {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-destructive/10 rounded-lg p-6">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-destructive">Loading Failed</h3>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Button onClick={retry} size="sm" variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      );
    }

    if (status !== "ready") {
      const messages = {
        camera: "Starting camera...",
        model: "Loading AI model..."
      };

      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm rounded-lg">
          <div className="relative">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="absolute -inset-2 rounded-full border-2 border-primary/20" style={{
              animation: 'pulse 2s infinite'
            }} />
          </div>
          <div className="text-center space-y-2">
            <p className="font-medium">{messages[status] || "Initializing..."}</p>
            <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{progress}%</p>
          </div>
        </div>
      );
    }

    return null;
  };

  const isReady = status === "ready";
  const isDisabled = !isReady || isSubmitting || isVerifying;

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
              Please remove any visible phones or screens from the frame.
            </AlertDescription>
          </Alert>
        )}

        <div className="relative aspect-video w-full bg-gray-100 rounded-lg overflow-hidden border">
          <video
            ref={videoRef}
            className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${
              isReady ? 'opacity-100' : 'opacity-0'
            }`}
            autoPlay
            muted
            playsInline
          />
          <canvas ref={canvasRef} className="hidden" />
          {renderContent()}
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
          ) : !isReady ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <Camera className="mr-2 h-4 w-4" />
              Capture & Submit
            </>
          )}
        </Button>
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
