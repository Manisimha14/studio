
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { useGeolocator } from "@/hooks/use-geolocator";
import useSound from "use-sound";


export default function AttendancePage() {
  const { addRecord } = useAttendance();
  const { toast } = useToast();
  const router = useRouter();
  const { location, error, status } = useGeolocator({ enableHighAccuracy: true });
  
  const [step, setStep] = useState(1); // 1: Form, 2: Snapshot, 3: Success
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [floorNumber, setFloorNumber] = useState("");
  const [virtualCameraDetected, setVirtualCameraDetected] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [playClick] = useSound('/sounds/click.mp3', { volume: 0.5 });
  const [playSuccess] = useSound('/sounds/success.mp3', { volume: 0.5 });
  const [playError] = useSound('/sounds/error.mp3', { volume: 0.5 });
  const [playCapture] = useSound('/sounds/capture.mp3', { volume: 0.5 });
  
  const getCameraPermission = async () => {
    setVirtualCameraDetected(false);
    try {
       const devices = await navigator.mediaDevices.enumerateDevices();
       const videoInputs = devices.filter(device => device.kind === 'videoinput');
       
       const suspiciousKeywords = ['obs', 'droidcam', 'splitcam', 'vcam'];
       const isVirtualCamera = videoInputs.some(device => 
         suspiciousKeywords.some(keyword => device.label.toLowerCase().includes(keyword))
       );

       if (isVirtualCamera) {
          setVirtualCameraDetected(true);
          setHasCameraPermission(false);
          playError();
          toast({
            variant: 'destructive',
            title: 'Unsupported Camera Detected',
            description: 'Use of virtual camera software like OBS or Droidcam is not allowed.',
          });
          return;
       }

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      setHasCameraPermission(false);
      playError();
      if ((error as Error).name !== 'NotAllowedError') {
        toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings.',
        });
      }
    }
  };

  useEffect(() => {
    if (step === 2 && !snapshot) {
      getCameraPermission();
    }
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [step, snapshot]);


  const handleCapture = () => {
    playCapture();
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
        setSnapshot(dataUrl);

        const stream = video.srcObject as MediaStream;
        if(stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
    }
  };

  const handleRetake = () => {
    playClick();
    setSnapshot(null);
  };

  const handleNextStep = () => {
     playClick();
     if (!studentName || !floorNumber) {
      playError();
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please enter your name and floor number.",
      });
      return;
    }
    if (!location) {
      playError();
      toast({
        variant: "destructive",
        title: "Location Error",
        description: "Could not get your location. Please ensure it's enabled.",
      });
      return;
    }
    setStep(2);
  }


  const handleMarkAttendance = async () => {
    playClick();
    if (!snapshot) {
        playError();
        toast({
            variant: "destructive",
            title: "Snapshot Required",
            description: "Please take a snapshot to continue.",
        });
        return;
    }
    setIsSubmitting(true);
    try {
        await addRecord({ studentName, floorNumber, location: location!, photo: snapshot });
        playSuccess();
        setStep(3); // Move to success step
        toast({
          title: "Success!",
          description: "Thank you for marking the attendance.",
        });
        setTimeout(() => router.push("/"), 3000);

    } catch (error) {
        console.error("Error marking attendance:", error);
        playError();
        const errorMessage = (error as Error)?.message || "Could not mark attendance. Please try again.";
        toast({
            variant: "destructive",
            title: "Submission Failed",
            description: errorMessage,
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  const isFormDisabled = isSubmitting;

  const renderLocationStatus = () => {
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
  };
  
  if (step === 3) {
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


  return (
    <div className="flex items-start justify-center py-8 fade-in">
      <Card className="w-full max-w-lg shadow-xl transition-all">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">
            {step === 1 ? "Mark Your Attendance" : "Take a Snapshot"}
          </CardTitle>
          <CardDescription>
            {step === 1 ? "Complete the steps below to record your attendance." : "A snapshot is required for verification."}
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
            </CardContent>
            <CardFooter>
                 <Button onClick={handleNextStep} disabled={!location || isFormDisabled} className="w-full py-6 text-lg font-semibold transition-all hover:scale-105 active:scale-100">
                    Next: Take Snapshot
                 </Button>
            </CardFooter>
            </>
        )}

        {step === 2 && (
            <>
            <CardContent className="space-y-4">
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
                   <Alert variant="destructive" className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                        <Ban className="h-10 w-10" />
                        <AlertTitle>Unsupported Camera Detected</AlertTitle>
                        <AlertDescription>Please disable virtual camera software (like OBS) and use a physical webcam.</AlertDescription>
                    </Alert>
                )}

                {hasCameraPermission === false && !virtualCameraDetected && (
                    <Alert variant="destructive" className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                        <VideoOff className="h-10 w-10" />
                        <AlertTitle>Camera Access Denied</AlertTitle>
                        <AlertDescription>Allow camera access in your browser settings and refresh.</AlertDescription>
                    </Alert>
                )}
                
                 {hasCameraPermission === null && !snapshot && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 text-center">
                        <p className="text-muted-foreground">The app needs camera access to take a snapshot.</p>
                        <Button onClick={() => { playClick(); getCameraPermission(); }}><Camera className="mr-2"/>Enable Camera</Button>
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
                    className="w-full py-6 text-lg font-bold transition-all hover:scale-105 active:scale-100"
                >
                    {isSubmitting ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                    <CheckCircle className="mr-2 h-5 w-5" />
                    )}
                    {isSubmitting ? "Submitting..." : "Submit Attendance"}
                </Button>
                 <Button variant="link" onClick={() => { playClick(); setStep(1); }} disabled={isFormDisabled}>
                     <ArrowLeft className="mr-2" />
                     Go Back
                 </Button>
            </CardFooter>
            </>
        )}
      </Card>
    </div>
  );
}
