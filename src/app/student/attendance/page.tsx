
"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAttendance } from "@/context/AttendanceContext";
import { useToast } from "@/hooks/use-toast";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/components/ui/alert";
import {
  Loader2,
  MapPin,
  Camera,
  CheckCircle,
  VideoOff,
  User,
  Building,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Ban,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useGeolocator } from "@/hooks/use-geolocator";
import { playSound } from "@/lib/utils";

// Simple UUID generator
const getDeviceId = () => {
  if (typeof window === 'undefined') return '';
  let deviceId = localStorage.getItem('device-id');
  if (!deviceId) {
    deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
    localStorage.setItem('device-id', deviceId);
  }
  return deviceId;
};

const LIVENESS_CHALLENGES = [
    "Smile for the camera",
    "Slowly blink three times",
    "Turn your head to the left",
    "Turn your head to the right",
    "Hold up your right hand"
];

export default function AttendancePage() {
  const { addRecord } = useAttendance();
  const { toast } = useToast();
  const router = useRouter();
  const { location, error, status } = useGeolocator({ enableHighAccuracy: true });
  
  const [step, setStep] = useState(1); // 1: Form, 2: Liveness, 3: Snapshot, 4: Success
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [floorNumber, setFloorNumber] = useState("");
  const [deviceId, setDeviceId] = useState('');
  const [virtualCameraDetected, setVirtualCameraDetected] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const livenessChallenge = useMemo(() => LIVENESS_CHALLENGES[Math.floor(Math.random() * LIVENESS_CHALLENGES.length)], []);

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  const getCameraPermission = useCallback(async (isRetry = false) => {
    if (isRetry) {
        playSound('click');
    }
    setVirtualCameraDetected(false);
    try {
       const devices = await navigator.mediaDevices.enumerateDevices();
       const videoInputs = devices.filter(device => device.kind === 'videoinput');
       
       if (videoInputs.length === 0) {
         throw new Error("No camera found.");
       }

       const suspiciousKeywords = ['obs', 'droidcam', 'splitcam', 'vcam', 'virtual', 'proxy'];
       const isVirtualCamera = videoInputs.some(device => 
         suspiciousKeywords.some(keyword => device.label.toLowerCase().includes(keyword))
       );
       
       const hasPhysicalCamera = videoInputs.some(device => 
         !suspiciousKeywords.some(keyword => device.label.toLowerCase().includes(keyword))
       );

       if (isVirtualCamera && !hasPhysicalCamera) {
          setVirtualCameraDetected(true);
          setHasCameraPermission(false);
          playSound('error');
          toast({
            variant: 'destructive',
            title: 'Physical Webcam Required',
            description: 'Use of virtual cameras is not allowed. Please connect a physical webcam.',
            duration: 5000,
          });
          return;
       }

      const stream = await navigator.mediaDevices.getUserMedia({ video: {
        facingMode: 'user'
      } });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      setHasCameraPermission(false);
      playSound('error');
      const err = error as Error;
      if (err.name === 'NotAllowedError') {
         toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings.',
        });
      } else {
        toast({
            variant: 'destructive',
            title: 'Camera Error',
            description: err.message || "Could not access the camera.",
        });
      }
    }
  }, [toast]);

  useEffect(() => {
    const isCameraStep = step === 2 || (step === 3 && !snapshot);
    
    if (isCameraStep && hasCameraPermission === null) {
        getCameraPermission();
    }

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [step, snapshot, getCameraPermission, hasCameraPermission]);


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
        setSnapshot(dataUrl);

        const stream = video.srcObject as MediaStream;
        if(stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
    }
  }, []);

  const handleRetake = useCallback(() => {
    playSound('click');
    setSnapshot(null);
    getCameraPermission(); // Re-request camera access
  }, [getCameraPermission]);

  const handleProceedToLiveness = useCallback(() => {
     playSound('click');
     if (!studentName || !floorNumber) {
      playSound('error');
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please enter your name and floor number.",
      });
      return;
    }
    if (!location) {
      playSound('error');
      toast({
        variant: "destructive",
        title: "Location Error",
        description: "Could not get your location. Please ensure it's enabled.",
      });
      return;
    }
    setStep(2);
  }, [studentName, floorNumber, location, toast]);


  const handleProceedToSnapshot = useCallback(() => {
    playSound('click');
    setStep(3);
  }, []);

  const handleMarkAttendance = useCallback(async () => {
    playSound('click');
    if (!snapshot) {
        playSound('error');
        toast({
            variant: "destructive",
            title: "Snapshot Required",
            description: "Please take a snapshot to continue.",
        });
        return;
    }
    setIsSubmitting(true);
    try {
        await addRecord({ 
          studentName: studentName.trim(), 
          floorNumber, 
          location: location!, 
          photo: snapshot,
          deviceId: deviceId,
          livenessChallenge: livenessChallenge
        });
        playSound('success');
        setStep(4);
        toast({
          title: "Success!",
          description: "Thank you for marking the attendance.",
        });
        setTimeout(() => router.push("/"), 3000);

    } catch (error) {
        console.error("Error marking attendance:", error);
        playSound('error');
        const errorMessage = (error as Error)?.message || "Could not mark attendance. Please try again.";
        toast({
            variant: "destructive",
            title: "Submission Failed",
            description: errorMessage,
        });
    } finally {
        setIsSubmitting(false);
    }
  }, [snapshot, addRecord, studentName, floorNumber, location, toast, router, deviceId, livenessChallenge]);

  const isFormDisabled = isSubmitting;

  const renderLocationStatus = useCallback(() => {
    switch (status) {
      case 'pending':
        return (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Acquiring location...</span>
          </div>
        );
      case 'denied':
      case 'error':
        return (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Location Error</AlertTitle>
            <AlertDescription>{error?.message || 'Could not get your location. Please enable it in your browser settings.'}</AlertDescription>
          </Alert>
        );
      case 'success':
        if (location) {
          return (
            <Alert variant="default" className="border-green-500/50 bg-green-500/10 text-green-700">
              <MapPin className="h-4 w-4 text-green-600" />
              <AlertTitle>Location Acquired</AlertTitle>
              <AlertDescription>
                  Your location is locked and ready.
              </AlertDescription>
            </Alert>
          );
        }
        return null;
      default:
        return null;
    }
  }, [status, error, location]);
  
  const renderCameraView = useCallback(() => (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border-2 border-dashed bg-muted">
        <video
            ref={videoRef}
            className={`h-full w-full object-cover transition-opacity duration-300 ${snapshot ? 'opacity-0' : 'opacity-100'}`}
            autoPlay
            muted
            playsInline
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {virtualCameraDetected && (
           <Alert variant="destructive" className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-4">
                <Ban className="h-10 w-10" />
                <AlertTitle>Physical Webcam Required</AlertTitle>
                <AlertDescription>The use of virtual camera software is not permitted. Please use a physical webcam.</AlertDescription>
            </Alert>
        )}

        {hasCameraPermission === false && !virtualCameraDetected && (
            <Alert variant="destructive" className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-4">
                <VideoOff className="h-10 w-10" />
                <AlertTitle>Camera Access Denied</AlertTitle>
                <AlertDescription>Please allow camera access in your browser settings and ensure a physical webcam is connected.</AlertDescription>
                <Button onClick={() => getCameraPermission(true)}><RefreshCw className="mr-2"/>Try Again</Button>
            </Alert>
        )}
        
         {hasCameraPermission === null && !snapshot && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
                <p className="text-muted-foreground">Requesting camera access...</p>
            </div>
        )}

        {snapshot && (
            <img
            src={snapshot}
            alt="Snapshot"
            className="absolute inset-0 h-full w-full object-cover"
            />
        )}
    </div>
  ), [snapshot, virtualCameraDetected, hasCameraPermission, getCameraPermission]);


  if (step === 4) {
      return (
           <div className="flex items-start justify-center py-8 fade-in">
              <Card className="w-full max-w-lg text-center shadow-lg">
                <CardHeader>
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
                        <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
                    </div>
                </CardHeader>
                <CardContent>
                    <CardTitle className="text-3xl font-bold">Attendance Marked!</CardTitle>
                    <CardDescription className="mt-2 text-lg text-muted-foreground">
                        You will be redirected to the home page shortly.
                    </CardDescription>
                </CardContent>
              </Card>
           </div>
      )
  }

  const getStepTitle = () => {
    switch(step) {
      case 1: return "Mark Your Attendance";
      case 2: return "Liveness Challenge";
      case 3: return "Identity Verification";
      default: return "";
    }
  }

  const getStepDescription = () => {
      switch(step) {
        case 1: return "Complete the steps below to record your attendance.";
        case 2: return "To ensure you are present, please perform the following action.";
        case 3: return "A snapshot is required for verification. Make sure you are doing the action from the previous step.";
        default: return "";
      }
  }


  return (
    <div className="flex items-start justify-center py-8 fade-in">
      <Card className="w-full max-w-lg shadow-xl transition-all">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">
            {getStepTitle()}
          </CardTitle>
          <CardDescription>
            {getStepDescription()}
          </CardDescription>
        </CardHeader>

        {step === 1 && (
            <>
            <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                <Label htmlFor="studentName" className="flex items-center gap-2 font-semibold">
                    <User className="text-primary" /> Full Name
                </Label>
                <Input
                    id="studentName"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="e.g., Jane Doe"
                    disabled={isFormDisabled}
                    className="text-base"
                />
                </div>
                <div className="space-y-2">
                <Label htmlFor="floorNumber" className="flex items-center gap-2 font-semibold">
                    <Building className="text-primary" /> Floor Number
                </Label>
                <Input
                    id="floorNumber"
                    value={floorNumber}
                    onChange={(e) => setFloorNumber(e.target.value)}
                    placeholder="e.g., 4th Floor"
                    disabled={isFormDisabled}
                    className="text-base"
                />
                </div>
            </div>

            <div className="space-y-4">
                <Label className="flex items-center gap-2 font-semibold">
                    <MapPin className="text-primary" /> Live Location
                </Label>
                {renderLocationStatus()}
            </div>
             <Alert variant="default" className="border-blue-500/50 bg-blue-500/10 text-blue-700">
                <Smartphone className="h-4 w-4 text-blue-600" />
                <AlertTitle>Device Verification</AlertTitle>
                <AlertDescription>
                    Your attendance will be locked to this device for today.
                    <p className="mt-1 text-xs truncate text-muted-foreground">Device ID: {deviceId}</p>
                </AlertDescription>
            </Alert>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleProceedToLiveness} disabled={!location || isFormDisabled} className="w-full py-6 text-lg font-semibold transition-all hover:scale-105 active:scale-100">
                    Next: Liveness Check
                 </Button>
            </CardFooter>
            </>
        )}

        {step === 2 && (
            <>
            <CardContent className="space-y-4">
               {renderCameraView()}
                <Alert>
                    <Sparkles className="h-4 w-4" />
                    <AlertTitle>Your Challenge:</AlertTitle>
                    <AlertDescription className="text-lg font-semibold text-primary">
                        {livenessChallenge}
                    </AlertDescription>
                </Alert>
            </CardContent>
            <CardFooter className="flex-col gap-4">
                 <Button onClick={handleProceedToSnapshot} disabled={!hasCameraPermission} className="w-full py-6 text-lg font-semibold transition-all hover:scale-105 active:scale-100">
                    I'm Ready, Go to Snapshot
                 </Button>
                 <Button variant="link" onClick={() => { playSound('click'); setStep(1); }} disabled={isFormDisabled}>
                     <ArrowLeft className="mr-2" />
                     Go Back
                 </Button>
            </CardFooter>
            </>
        )}

        {step === 3 && (
            <>
            <CardContent className="space-y-4">
                {renderCameraView()}
                <Alert variant="default" className="border-blue-500/50 bg-blue-500/10 text-blue-700">
                    <AlertTriangle className="h-4 w-4 text-blue-600" />
                    <AlertTitle>Reminder: {livenessChallenge}</AlertTitle>
                    <AlertDescription>
                        Please perform this action while taking the snapshot.
                    </AlertDescription>
                </Alert>
                <div className="flex gap-2">
                <Button
                    onClick={handleCapture}
                    disabled={!!snapshot || !hasCameraPermission || isFormDisabled}
                    className="flex-1 transition-all hover:scale-105 active-scale-100"
                >
                    <Camera className="mr-2" />
                    {snapshot ? "Snapshot Taken" : "Take Snapshot"}
                </Button>
                {snapshot && (
                    <Button onClick={handleRetake} variant="outline" disabled={isFormDisabled} className="transition-all hover:scale-105 active-scale-100">
                        <RefreshCw className="mr-2" />
                        Retake
                    </Button>
                )}
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
                <Button
                    onClick={handleMarkAttendance}
                    disabled={isFormDisabled || !snapshot}
                    className="w-full py-6 text-lg font-bold transition-all hover:scale-105 active-scale-100"
                >
                    {isSubmitting ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                    <CheckCircle className="mr-2 h-5 w-5" />
                    )}
                    {isSubmitting ? "Submitting..." : "Submit Attendance"}
                </Button>
                 <Button variant="link" onClick={() => { playSound('click'); setStep(2); setSnapshot(null); }} disabled={isFormDisabled}>
                     <ArrowLeft className="mr-2" />
                     Back to Challenge
                 </Button>
            </CardFooter>
            </>
        )}
      </Card>
    </div>
  );
}

    