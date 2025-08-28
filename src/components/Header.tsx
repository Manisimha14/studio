
'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function Header({ title }: { title: string }) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-card px-4 sm:px-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back</span>
        </Button>
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <CheckSquare className="h-6 w-6 text-primary" />
        <span className="hidden text-lg font-bold text-primary sm:inline">
          GeoAttendance
        </span>
      </div>
    </header>
  );
}
