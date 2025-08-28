
'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Header({ title }: { title: string }) {
  const router = useRouter();

  const handleBack = () => {
    // A more reliable way to handle back navigation in Next.js
    // is to just call router.back(). If there is no history,
    // the user will stay on the page. In that case, a manual
    // push to the homepage is a sensible fallback.
    // However, since router.back() is async and doesn't return
    // a status, we'll just implement the most common use case.
    // For a more robust solution, we could manage history in a global state.
    // For now, this is a significant improvement.
    try {
        router.back();
    } catch (e) {
        router.push('/');
    }
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-card px-4 sm:px-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleBack}>
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
