"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAttendance } from "@/context/AttendanceContext";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  MapPin,
  Clock,
  Camera,
  CheckCircle,
  VideoOff,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AttendancePage() {
  const { addRecord } = useAttendance();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isMarked, setIsMarked] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<
    boolean | undefined
  >(undefined);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
        setHasCameraPermission(false);
        toast({
          variant: "destructive",
          title: "Camera Access Denied",
          description:
            "Please enable camera permissions in your browser settings to use this app.",
        });
      }
    };

    getCameraPermission();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [toast]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationError(null);
      },
      () => {
        setLocationError(
          "Unable to retrieve your location. Please enable location services."
        );
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
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
      }
    }
  };

  const handleMarkAttendance = () => {
    if (!location) {
      toast({
        variant: "destructive",
        title: "Location Error",
        description:
          "Could not get your location. Please ensure it's enabled and try again.",
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

    setTimeout(() => {
      const newRecord = {
        studentName: `Student-${Math.random()
          .toString(36)
          .substring(2, 7)
          .toUpperCase()}`,
        timestamp: new Date().toLocaleString(),
        location,
      };

      addRecord(newRecord);
      setIsLoading(false);
      setIsMarked(true);
      toast({
        title: "Success!",
        description: "Your attendance has been marked successfully.",
      });
    }, 1500);
  };

  return (
    <div className="flex items-start justify-center pt-10">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Mark Your Attendance</CardTitle>
          <CardDescription>
            A snapshot and your location are required to mark attendance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                autoPlay
                muted
                playsInline
              />
              <canvas ref={canvasRef} className="hidden" />
              {hasCameraPermission === false && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-destructive">
                  <VideoOff className="h-10 w-10" />
                  <p className="font-semibold">Camera Access Denied</p>
                  <p className="text-xs text-muted-foreground">
                    Please enable camera permissions in your browser settings.
                  </p>
                </div>
              )}
              {hasCameraPermission === undefined && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
                  disabled={!!snapshot}
                  className="flex-1"
                >
                  <Camera className="mr-2" />
                  {snapshot ? "Snapshot Taken" : "Take Snapshot"}
                </Button>
                {snapshot && (
                  <Button
                    onClick={() => setSnapshot(null)}
                    variant="outline"
                  >
                    Retake
                  </Button>
                )}
              </div>
            )}
            {hasCameraPermission === false && (
              <Alert variant="destructive">
                <AlertTitle>Camera Access Required</AlertTitle>
                <AlertDescription>
                  Please allow camera access to use this feature.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex items-center gap-4 rounded-lg bg-muted p-4">
            <Clock className="h-6 w-6 text-muted-foreground" />
            <span className="text-muted-foreground">
              Timestamp will be recorded automatically
            </span>
          </div>

          <div className="flex items-start gap-4 rounded-lg border p-4">
            <MapPin className="mt-1 h-6 w-6 text-primary" />
            <div>
              <h4 className="font-semibold">Live Location</h4>
              {locationError && (
                <p className="text-sm text-destructive">{locationError}</p>
              )}
              {location && !locationError && (
                <p className="text-sm text-muted-foreground">
                  Lat: {location.latitude.toFixed(4)}, Long:{" "}
                  {location.longitude.toFixed(4)}
                </p>
              )}
              {!location && !locationError && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Acquiring location...</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleMarkAttendance}
            disabled={isLoading || !location || !snapshot || isMarked}
            className="w-full py-6 text-lg"
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
              : "Mark Attendance"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
