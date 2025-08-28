import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="flex items-center gap-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Loading GeoAttendance
          </h1>
          <p className="text-muted-foreground">Please wait a moment...</p>
        </div>
      </div>
    </div>
  );
}
