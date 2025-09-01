
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
} from "lucide-react";
import { useGeolocator } from "@/hooks/use-geolocator";

export default function AttendancePage() {
  const { addRecord } = useAttendance();
  const { toast } = useToast();
  const router = useRouter();
  const { location, error, status } = useGeolocator({ enableHighAccuracy: true });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMarked, setIsMarked] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [floorNumber, setFloorNumber] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shake, setShake] = useState(false);

  const getCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Camera Access Denied',
        description: 'Please enable camera permissions in your browser settings.',
      });
    }
  };


  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
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
    setSnapshot(null);
    getCameraPermission();
  };


  const handleMarkAttendance = async () => {
    if (!studentName || !floorNumber) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please enter your name and floor number.",
      });
      return;
    }
    
    if (!location) {
      toast({
        variant: "destructive",
        title: "Location Error",
        description: "Could not get your location. Please ensure it's enabled.",
      });
      return;
    }

    if (!snapshot) {
      toast({
        variant: "destructive",
        title: "Snapshot Required",
        description: "Please take a snapshot before marking attendance.",
      });
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setIsSubmitting(true);

    try {
        await addRecord({ studentName, floorNumber, location, photo: snapshot });
        setIsMarked(true);
        toast({
          title: "Success!",
          description: "Thank you for marking the attendance.",
        });
        setTimeout(() => router.push("/"), 2000);

    } catch (error) {
        console.error("Error marking attendance:", error);
        toast({
            variant: "destructive",
            title: "Submission Failed",
            description: "Could not mark attendance. Please try again.",
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  const isFormDisabled = isMarked || isSubmitting;

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
            <Alert>
              <MapPin className="h-4 w-4" />
              <AlertTitle>Location Acquired</AlertTitle>
              <AlertDescription>
                  Lat: {location.latitude.toFixed(4)}, Long: {location.longitude.toFixed(4)}
              </AlertDescription>
            </Alert>
          );
        }
        return null;
      default:
        return null;
    }
  };


  return (
    <div className="flex items-start justify-center py-8">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Mark Your Attendance</CardTitle>
          <CardDescription>
            Complete the steps below to record your attendance.
          </CardDescription>
        </CardHeader>
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
              />
            </div>
          </div>

          <div className="space-y-4">
             <Label className="flex items-center gap-2 font-semibold">
                <Camera className="text-primary" /> Photo Verification
              </Label>
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border-2 border-dashed bg-muted">
              <video
                ref={videoRef}
                className={`h-full w-full object-cover ${snapshot ? 'hidden' : ''}`}
                autoPlay
                muted
                playsInline
              />
              <canvas ref={canvasRef} className="hidden" />

              {hasCameraPermission === false && (
                <Alert variant="destructive" className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                    <VideoOff className="h-10 w-10" />
                    <AlertTitle>Camera Access Denied</AlertTitle>
                    <AlertDescription>Allow camera access in your browser settings and refresh.</AlertDescription>
                </Alert>
              )}
              {hasCameraPermission === null && !snapshot && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 text-center">
                    <p className="text-muted-foreground">The app needs camera access for a photo verification.</p>
                    <Button onClick={getCameraPermission}><Camera className="mr-2"/>Enable Camera</Button>
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
            
            <div className={`flex gap-2 ${shake ? 'animate-shake' : ''}`}>
              <Button
                onClick={handleCapture}
                disabled={!!snapshot || !hasCameraPermission || isFormDisabled}
                className="flex-1"
              >
                <Camera className="mr-2" />
                {snapshot ? "Snapshot Taken" : "Take Snapshot"}
              </Button>
              {snapshot && (
                <Button onClick={handleRetake} variant="outline"  disabled={isFormDisabled}>
                  Retake
                </Button>
              )}
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
          <Button
            onClick={handleMarkAttendance}
            disabled={isFormDisabled || !location || !snapshot}
            className="w-full py-6 text-lg font-bold"
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : isMarked ? (
              <CheckCircle className="mr-2 h-5 w-5" />
            ) : null}
            {isSubmitting
              ? "Marking..."
              : isMarked
              ? "Attendance Marked"
              : "Mark My Attendance"}
          </Button>
        </CardFooter>
      </Card>
      <style jsx>{`
        .animate-shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
          transform: translate3d(0, 0, 0);
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  );
}
