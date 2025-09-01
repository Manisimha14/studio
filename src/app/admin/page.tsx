
"use client";

import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";
import { playSound } from "@/lib/utils";


export default function AdminLoginPage({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    playSound('click');
    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      playSound('success');
      toast({
        title: "Success",
        description: "Logged in successfully.",
      });
      onLoginSuccess();
    } else {
      playSound('error');
      toast({
        variant: "destructive",
        title: "Error",
        description: "Incorrect password.",
      });
    }
  };

  return (
    <Card className="w-full max-w-md fade-in shadow-xl transition-all hover:shadow-primary/20">
      <form onSubmit={handleLogin}>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-10 w-10 text-primary" />
          </div>
          <CardTitle>Admin Authentication</CardTitle>
          <CardDescription>
            Please enter the password to access the admin dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter password"
              className="text-base"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full font-semibold transition-all hover:scale-105 active:scale-100">
            Login
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
