
"use client";

import { useState, Suspense, lazy, useEffect } from "react";
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
  CheckCircle,
  User,
  Building,
  AlertTriangle,
  Smartphone,
  ArrowLeft,
} from "lucide-react";
import { useGeolocator } from "@/hooks/use-geolocator";
import { playSound } from "@/lib/utils";

// Lazy load the heavy verification component
const VerificationStep = lazy(() => import('./VerificationStep'));

// Simple UUID generator
const generateDeviceId = () => {
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

export default function AttendancePage() {
  const { addRecord } = useAttendance();
  const { toast } = useToast();
  const router = useRouter();
  const { location, error, status } = useGeolocator({ enableHighAccuracy: true });
  
  const [step, setStep] = useState(1); // 1: Form, 2: Verification
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [floorNumber, setFloorNumber] = useState("");
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    // This hook runs only on the client, after hydration, which prevents hydration errors.
    setDeviceId(generateDeviceId());
  }, []);

  const handleProceedToVerification = () => {
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
  };

  const handleMarkAttendance = async (snapshot: string, proxyDetected: boolean) => {
    if (isSubmitting) return; // Prevent double submission
    
    setIsSubmitting(true);
    playSound('click');

    if (!snapshot) {
        playSound('error');
        toast({
            variant: "destructive",
            title: "Snapshot Required",
            description: "Could not capture a snapshot.",
        });
        setIsSubmitting(false);
        return;
    }
    try {
        await addRecord({ 
          studentName: studentName.trim(), 
          floorNumber, 
          location: location!, 
          photo: snapshot,
          deviceId: deviceId,
          proxyDetected: proxyDetected,
        });
        playSound('success');
        setStep(3); // Go to success step
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
        setIsSubmitting(false);
    } 
  };

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
        {step === 1 && (
            <>
            <CardHeader>
              <CardTitle className="text-3xl font-bold">
                Mark Your Attendance
              </CardTitle>
              <CardDescription>
                Complete the form below to proceed to verification.
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
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
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
              {deviceId && (
                 <Alert variant="default" className="border-blue-500/50 bg-blue-500/10 text-blue-700">
                    <Smartphone className="h-4 w-4 text-blue-600" />
                    <AlertTitle>Device Verification</AlertTitle>
                    <AlertDescription>
                        Your attendance will be locked to this device for today.
                        <p className="mt-1 text-xs truncate text-muted-foreground">Device ID: {deviceId}</p>
                    </AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter>
                 <Button onClick={handleProceedToVerification} disabled={!location || isSubmitting || !studentName || !floorNumber} className="w-full py-6 text-lg font-semibold transition-all hover:scale-105 active-scale-100">
                    Next: Take Snapshot
                 </Button>
            </CardFooter>
            </>
        )}

        {step === 2 && (
          <Suspense fallback={
              <CardContent className="flex flex-col items-center justify-center space-y-4 p-8 min-h-[400px]">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading Camera...</p>
              </CardContent>
          }>
            <VerificationStep
              onVerified={handleMarkAttendance}
              isSubmitting={isSubmitting}
              onBack={() => setStep(1)}
            />
          </Suspense>
        )}
      </Card>
    </div>
  );
}
