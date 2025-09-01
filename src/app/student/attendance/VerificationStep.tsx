
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
  Ban,
  Sparkles,
  UserCheck,
  Smile,
  ArrowLeft,
} from "lucide-react";
import { playSound } from "@/lib/utils";
import {
  FaceLandmarker,
  FilesetResolver,
  FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { Badge } from "@/components/ui/badge";

interface VerificationStepProps {
    livenessChallenge: { action: string; key: string };
    onVerified: (snapshot: string | null) => Promise<void>;
    isSubmitting: boolean;
    onBack: () => void;
}

const LIVENESS_CHALLENGE_DURATION = 2; // seconds
const BLENDSHAPE_THRESHOLD = 0.5;

let faceLandmarker: FaceLandmarker | undefined;
let lastVideoTime = -1;
let animationFrameId: number;

export default function VerificationStep({ livenessChallenge, onVerified, isSubmitting, onBack }: VerificationStepProps) {
  const [status, setStatus] = useState<"initializing" | "loading_model" | "ready" | "error" | "permission_denied" | "virtual_camera">("initializing");
  const [faceDetected, setFaceDetected] = useState(false);
  const [livenessChallengeMet, setLivenessChallengeMet] = useState(false);
  const [countdown, setCountdown] = useState(LIVENESS_CHALLENGE_DURATION);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout>();

  const resetChallenge = useCallback(() => {
    setLivenessChallengeMet(false);
    setCountdown(LIVENESS_CHALLENGE_DURATION);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = undefined;
    }
  }, []);

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

  const checkLiveness = useCallback((blendshapes: any[]) => {
      if (!blendshapes || blendshapes.length === 0) return false;
      const scores = blendshapes[0].scores;

      switch(livenessChallenge.key) {
          case 'smile':
              return scores.find((s: any) => s.categoryName === 'mouthSmileLeft').score > BLENDSHAPE_THRESHOLD &&
                     scores.find((s: any) => s.categoryName === 'mouthSmileRight').score > BLENDSHAPE_THRESHOLD;
          case 'mouthOpen':
              return scores.find((s: any) => s.categoryName === 'jawOpen').score > BLENDSHAPE_THRESHOLD;
          case 'eyeBlinkLeft':
              return scores.find((s: any) => s.categoryName === 'eyeBlinkLeft').score > BLENDSHAPE_THRESHOLD;
          case 'eyeBlinkRight':
              return scores.find((s: any) => s.categoryName === 'eyeBlinkRight').score > BLENDSHAPE_THRESHOLD;
          default:
              return false;
      }
  }, [livenessChallenge.key]);

  const predictWebcam = useCallback(() => {
    if (!faceLandmarker || !videoRef.current || videoRef.current.paused || videoRef.current.ended) {
      animationFrameId = requestAnimationFrame(predictWebcam);
      return;
    }
    
    const video = videoRef.current;
    if (video.readyState >= 2 && video.videoWidth > 0 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const results: FaceLandmarkerResult = faceLandmarker.detectForVideo(video, Date.now());
      
      const newFaceDetected = results.faceLandmarks && results.faceLandmarks.length > 0;
      setFaceDetected(newFaceDetected);
      
      if (newFaceDetected) {
        const met = checkLiveness(results.faceBlendshapes);
        setLivenessChallengeMet(met);
      } else {
        setLivenessChallengeMet(false);
      }
    }

    animationFrameId = requestAnimationFrame(predictWebcam);
  }, [checkLiveness]);

  const setup = useCallback(async (isRetry = false) => {
      if (isRetry) playSound('click');
      setStatus("initializing");
      setLivenessChallengeMet(false);
      
      if (videoRef.current && videoRef.current.srcObject) {
         (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
      if (faceLandmarker) {
        faceLandmarker.close();
        faceLandmarker = undefined;
      }
      cancelAnimationFrame(animationFrameId);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(device => device.kind === 'videoinput');
        if (videoInputs.length === 0) throw new Error("No camera found.");
        const suspiciousKeywords = ['obs', 'droidcam', 'splitcam', 'vcam', 'virtual', 'proxy'];
        if (videoInputs.some(device => suspiciousKeywords.some(keyword => device.label.toLowerCase().includes(keyword)))) {
          setStatus("virtual_camera");
          playSound('error');
          return;
        }

        setStatus("loading_model");
        const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
        faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });

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
    setup();
    return () => {
      cancelAnimationFrame(animationFrameId);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (faceLandmarker) {
        faceLandmarker.close();
        faceLandmarker = undefined;
      }
    };
  }, [setup]);

  useEffect(() => {
    if (status === "ready") {
        lastVideoTime = -1;
        predictWebcam();
    }
  }, [status, predictWebcam]);

  useEffect(() => {
    if (livenessChallengeMet) {
      if (!countdownIntervalRef.current) {
        countdownIntervalRef.current = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(countdownIntervalRef.current!);
              handleCapture();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } else {
      resetChallenge();
    }

    return () => {
        if(countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = undefined;
        }
    }
  }, [livenessChallengeMet, resetChallenge, handleCapture]);


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
        case "loading_model":
            return (
                <div className={`${commonClasses} bg-background/80`}>
                    <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                    <p className="text-muted-foreground animate-pulse">Loading AI...</p>
                </div>
            );
        case "virtual_camera":
           return (
             <Alert variant="destructive" className={`${commonClasses} bg-destructive/90`}>
                  <Ban className="h-10 w-10" />
                  <AlertTitle>Physical Webcam Required</AlertTitle>
                  <AlertDescription>The use of virtual camera software is not permitted. Please use a physical webcam.</AlertDescription>
              </Alert>
           );
        case "permission_denied":
            return (
              <Alert variant="destructive" className={`${commonClasses} bg-destructive/90`}>
                  <VideoOff className="h-10 w-10" />
                  <AlertTitle>Camera Access Denied</AlertTitle>
                  <AlertDescription>Please allow camera access in your browser settings to continue.</AlertDescription>
                  <Button onClick={() => setup(true)}><RefreshCw className="mr-2"/>Try Again</Button>
              </Alert>
            );
        case "error":
            return (
              <Alert variant="destructive" className={`${commonClasses} bg-destructive/90`}>
                  <AlertTriangle className="h-10 w-10" />
                  <AlertTitle>An Error Occurred</AlertTitle>
                  <AlertDescription>Could not start verification. Please try again.</AlertDescription>
                  <Button onClick={() => setup(true)}><RefreshCw className="mr-2"/>Try Again</Button>
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
        <CardTitle className="text-3xl font-bold">Liveness Verification</CardTitle>
        <CardDescription>Perform the requested action to mark your attendance.</CardDescription>
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

            {status === "ready" && !isSubmitting && (
                <div className="absolute bottom-2 left-2 z-10 flex flex-col items-start gap-2">
                    <div className="flex gap-2">
                        {faceDetected ? (
                            <Badge variant="default" className="bg-green-600"><UserCheck className="mr-2 h-3 w-3"/>Face Detected</Badge>
                        ) : (
                            <Badge variant="destructive"><Smile className="mr-2 h-3 w-3"/>No Face Detected</Badge>
                        )}
                        {faceDetected && (
                            livenessChallengeMet ? (
                                <Badge variant="default" className="bg-green-600"><Sparkles className="mr-2 h-3 w-3"/>Challenge Met!</Badge>
                            ) : (
                                <Badge variant="secondary"><Sparkles className="mr-2 h-3 w-3"/>Challenge Pending</Badge>
                            )
                        )}
                    </div>
                    {livenessChallengeMet && (
                         <div className="text-white bg-black/50 rounded-full px-4 py-2 text-lg font-bold">
                           Capturing in {countdown}...
                         </div>
                    )}
                </div>
            )}
        </div>
        <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertTitle>Your Challenge:</AlertTitle>
            <AlertDescription className="text-lg font-semibold text-primary">
                {livenessChallenge.action}
            </AlertDescription>
        </Alert>
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
