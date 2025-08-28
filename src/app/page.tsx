import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';
import { User, Shield, GraduationCap } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-10 flex items-center gap-3 text-center">
        <GraduationCap className="h-12 w-12 text-primary" />
        <div>
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            Smart Uniworld 1
          </h1>
          <p className="text-muted-foreground">The Modern Attendance System</p>
        </div>
      </div>
      <Card className="w-full max-w-md border-0 shadow-2xl shadow-primary/10">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome!</CardTitle>
          <CardDescription>Please select your role to continue.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link href="/student/attendance" className="block">
            <div className="group rounded-xl border-2 border-transparent bg-accent p-6 text-center transition-all hover:border-primary hover:bg-primary/5">
              <div className="mb-4 flex justify-center">
                <User className="h-16 w-16 text-primary transition-transform group-hover:scale-110" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">
                Student
              </h3>
            </div>
          </Link>
          <Link href="/admin" className="block">
            <div className="group rounded-xl border-2 border-transparent bg-accent p-6 text-center transition-all hover:border-primary hover:bg-primary/5">
              <div className="mb-4 flex justify-center">
                <Shield className="h-16 w-16 text-primary transition-transform group-hover:scale-110" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">
                Admin
              </h3>
            </div>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
