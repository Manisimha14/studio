
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
      
      if (videoRef.current && videoRef.current.srcObject) {
         (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise((resolve) => {
            if (videoRef.current) {
              videoRef.current.onloadedmetadata = () => {
                videoRef.current?.play();
                resolve(null);
              };
            }
          });
        }
        
        setStatus("ready");

      } catch (error) {
        const err = error as Error;
        console.error("Setup failed:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setStatus("permission_denied");
        } else {
            setStatus("error");
        }
        playSound('error');
      }
  }, []);

  useEffect(() => {
    setupCamera();
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
                  <AlertDescription>Could not start camera. Please try again.</AlertDescription>
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
                className={`h-full w-full object-cover scale-x-[-1] transition-opacity duration-300 ${status !== 'initializing' ? 'opacity-100' : 'opacity-0'}`}
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
