
'use client';

import { Home, GraduationCap, LogOut, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRouter, usePathname } from 'next/navigation';
import { playSound } from '@/lib/utils';

export function Header({ title, onLogout }: { title: string; onLogout?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const showBackButton = pathname !== '/';

  const handleLogoutClick = () => {
    playSound('click');
    if (onLogout) {
        onLogout();
    }
  }

  const handleBackClick = () => {
    playSound('click');
    router.back();
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-card/80 px-4 backdrop-blur-sm sm:px-6">
      <div className="flex items-center gap-4">
        {showBackButton ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={handleBackClick}
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Button>
        ) : (
           <Link href="/" className="flex items-center gap-2" onClick={() => playSound('click')}>
            <GraduationCap className="h-6 w-6 text-primary" />
           </Link>
        )}
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2" onClick={() => playSound('click')}>
            <span className="hidden text-lg font-bold text-primary sm:inline">
              Smart Uniworld 1
            </span>
        </Link>
        {onLogout && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogoutClick}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
        )}
      </div>
    </header>
  );
}
