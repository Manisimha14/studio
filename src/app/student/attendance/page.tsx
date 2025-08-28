
"use client";

import { useState, useRef, useEffect } from "react";
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
import { reverseGeocode } from "@/ai/flows/reverse-geocode-flow";

export default function AttendancePage() {
  const { addRecord } = useAttendance();
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
   const [placeName, setPlaceName] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isMarked, setIsMarked] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(true);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [floorNumber, setFloorNumber] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const requestPermissions = async () => {
      // Request camera permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
        setHasCameraPermission(false);
      }

      // Request location permission
      if (!navigator.geolocation) {
        setLocationError("Geolocation is not supported by your browser.");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setLocation(coords);
          setLocationError(null);
          setIsGeocoding(true);
           try {
            const { placeName } = await reverseGeocode(coords);
            setPlaceName(placeName);
          } catch (error) {
            console.error("Reverse geocoding failed:", error);
            setPlaceName("Unknown Location");
          } finally {
            setIsGeocoding(false);
          }
        },
        () => {
          setLocationError("Unable to retrieve your location. Please enable location services.");
        },
        { enableHighAccuracy: true } // Request high accuracy
      );
    };

    requestPermissions();

    // Cleanup function to stop media stream
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
        const dataUrl = canvas.toDataURL("image/png");
        setSnapshot(dataUrl);

        // Stop the camera stream after taking a snapshot
        const stream = video.srcObject as MediaStream;
        if(stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
    }
  };

  const handleRetake = () => {
    setSnapshot(null);
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
        setHasCameraPermission(false);
      }
    };
    getCameraPermission();
  };


  const handleMarkAttendance = () => {
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
        description: "Could not get your location. Please ensure it's enabled and try again.",
      });
      return;
    }

    if (!placeName) {
      toast({
        variant: 'destructive',
        title: 'Location Error',
        description: 'Could not determine the place name. Please try again.',
      });
      return;
    }

    if (!snapshot) {
      toast({
        variant: "destructive",
        title: "Snapshot Required",
        description: "Please take a snapshot before marking attendance.",
      });
      return;
    }

    if (isMarked) {
      toast({
        title: "Already Marked",
        description: "You have already marked your attendance.",
      });
      return;
    }

    setIsLoading(true);

    const newRecord = {
      studentName,
      floorNumber,
      timestamp: new Date().toLocaleString(),
      location,
      placeName,
      photo: snapshot,
    };

    addRecord(newRecord);
    setIsLoading(false);
    setIsMarked(true);
    toast({
      title: "Success!",
      description: "Thank you for marking the attendance.",
    });
    router.push("/");
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
                disabled={isMarked}
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
                disabled={isMarked}
              />
            </div>
          </div>

          <div className="space-y-4">
             <Label className="flex items-center gap-2 font-semibold">
                <Camera className="text-primary" /> Snapshot
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
              {!hasCameraPermission && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-destructive p-4">
                  <VideoOff className="h-10 w-10" />
                  <p className="font-semibold">Camera Access Denied</p>
                   <p className="text-sm">Please allow camera access in your browser settings.</p>
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
            {hasCameraPermission && (
              <div className="flex gap-2">
                <Button
                  onClick={handleCapture}
                  disabled={!!snapshot || isMarked}
                  className="flex-1"
                >
                  <Camera className="mr-2" />
                  {snapshot ? "Snapshot Taken" : "Take Snapshot"}
                </Button>
                {snapshot && (
                  <Button onClick={handleRetake} variant="outline"  disabled={isMarked}>
                    Retake
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <Label className="flex items-center gap-2 font-semibold">
                <MapPin className="text-primary" /> Live Location
              </Label>
            {locationError && (
                 <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Location Error</AlertTitle>
                    <AlertDescription>{locationError}</AlertDescription>
                  </Alert>
              )}
             {location && !locationError && (
                 <Alert>
                    <MapPin className="h-4 w-4" />
                    <AlertTitle>{isGeocoding ? 'Acquiring location name...' : placeName || 'Location name not found'}</AlertTitle>
                    <AlertDescription>
                        Lat: {location.latitude.toFixed(4)}, Long: {location.longitude.toFixed(4)}
                    </AlertDescription>
                  </Alert>
             )}
             {!location && !locationError && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Acquiring location...</span>
                  </div>
              )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleMarkAttendance}
            disabled={isLoading || !location || !snapshot || isMarked || !placeName || isGeocoding}
            className="w-full py-6 text-lg font-bold"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : isMarked ? (
              <CheckCircle className="mr-2 h-5 w-5" />
            ) : null}
            {isLoading
              ? "Marking..."
              : isMarked
              ? "Attendance Marked"
              : "Mark My Attendance"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
