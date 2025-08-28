import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import Link from 'next/link';
import { User, Shield } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-primary">
            GeoAttendance MVP
          </h1>
          <CardDescription className="pt-2 text-lg">
            Please select your role to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Link href="/student/attendance" className="block">
            <div className="group rounded-lg border-2 border-transparent bg-secondary p-6 text-center transition-all hover:border-primary hover:bg-primary/5">
              <div className="mb-4 flex justify-center">
                <User className="h-16 w-16 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold text-secondary-foreground">
                Student
              </h3>
            </div>
          </Link>
          <Link href="/admin/dashboard" className="block">
            <div className="group rounded-lg border-2 border-transparent bg-secondary p-6 text-center transition-all hover:border-primary hover:bg-primary/5">
              <div className="mb-4 flex justify-center">
                <Shield className="h-16 w-16 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold text-secondary-foreground">
                Admin
              </h3>
            </div>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
