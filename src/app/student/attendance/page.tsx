"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";

export default function AttendancePage() {
  const { addRecord } = useAttendance();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMarked, setIsMarked] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setError(null);
      },
      () => {
        setError(
          "Unable to retrieve your location. Please enable location services."
        );
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

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
            We need your location to verify you're in the right place.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4 rounded-lg bg-muted p-4">
            <Camera className="h-6 w-6 text-muted-foreground" />
            <span className="text-muted-foreground">
              Photo capture placeholder
            </span>
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
              {error && <p className="text-sm text-destructive">{error}</p>}
              {location && !error && (
                <p className="text-sm text-muted-foreground">
                  Lat: {location.latitude.toFixed(4)}, Long:{" "}
                  {location.longitude.toFixed(4)}
                </p>
              )}
              {!location && !error && (
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
            disabled={isLoading || !location || isMarked}
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
