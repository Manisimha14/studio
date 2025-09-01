
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

export default function VerificationStep({ onVerified, isSubmitting, onBack }: VerificationStepProps) {
  const [status, setStatus] = useState<"initializing" | "ready" | "error" | "permission_denied">("initializing");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
        // Flip the image horizontally for a mirror effect
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        onVerified(dataUrl);
      } else {
        onVerified(null);
      }
    } else {
      onVerified(null);
    }
  }, [onVerified]);
  
  const setupCamera = useCallback(async (isRetry = false) => {
      if (isRetry) playSound('click');
      setStatus("initializing");

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        playSound('error');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // The 'onloadedmetadata' event listener is more reliable
            videoRef.current.onloadedmetadata = () => {
                videoRef.current?.play().then(() => {
                    setStatus("ready");
                }).catch(e => {
                    console.error("Video play failed:", e);
                    setStatus("error");
                    playSound('error');
                });
            };
        }
      } catch (error) {
        console.error("Camera setup failed:", error);
        if (error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')) {
            setStatus("permission_denied");
        } else {
            setStatus("error");
        }
        playSound('error');
      }
  }, []);

  useEffect(() => {
    setupCamera();
    
    // Cleanup function to stop all video tracks when the component unmounts
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [setupCamera]);

  const renderOverlay = () => {
    const commonClasses = "absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-4 rounded-lg";
    switch (status) {
        case "initializing":
            return (
                <div className={`${commonClasses} bg-background/80`}>
                    <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                    <p className="text-muted-foreground animate-pulse">Initializing Camera...</p>
                </div>
            );
        case "permission_denied":
            return (
              <Alert variant="destructive" className={`${commonClasses} bg-destructive/90`}>
                  <VideoOff className="h-10 w-10" />
                  <AlertTitle>Camera Access Denied</AlertTitle>
                  <AlertDescription>Please allow camera access in your browser settings to continue.</AlertDescription>
                  <Button onClick={() => setupCamera(true)}><RefreshCw className="mr-2"/>Try Again</Button>
              </Alert>
            );
        case "error":
            return (
              <Alert variant="destructive" className={`${commonClasses} bg-destructive/90`}>
                  <AlertTriangle className="h-10 w-10" />
                  <AlertTitle>An Error Occurred</AlertTitle>
                  <AlertDescription>Could not start camera. Please check device permissions and try again.</AlertDescription>
                  <Button onClick={() => setupCamera(true)}><RefreshCw className="mr-2"/>Try Again</Button>
              </Alert>
            );
        case "ready":
             if (isSubmitting) {
                return (
                    <div className={`${commonClasses} bg-background/80`}>
                        <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                        <p className="text-muted-foreground">Submitting...</p>
                    </div>
                );
            }
            return null;
        default:
            return null;
    }
  }

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
                className={`h-full w-full object-cover scale-x-[-1] transition-opacity duration-300 ${status === 'ready' ? 'opacity-100' : 'opacity-0'}`}
                autoPlay
                muted
                playsInline
            />
            <canvas ref={canvasRef} className="hidden" />
            {renderOverlay()}
        </div>
        <Button 
            onClick={handleCapture} 
            disabled={status !== 'ready' || isSubmitting}
            className="w-full py-6 text-lg font-semibold"
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
