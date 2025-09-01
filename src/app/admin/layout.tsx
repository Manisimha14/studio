
'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import Loading from '../loading';
import AdminLoginPage from './page';

function AdminLayoutContent({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const session = window.localStorage.getItem('adminAuthenticated');
    const authenticated = session === 'true';
    setIsAuthenticated(authenticated);
  }, []);
  
  useEffect(() => {
     if (isAuthenticated === null) return;
     
     if (isAuthenticated && pathname === '/admin') {
       router.replace('/admin/dashboard');
     } else if (!isAuthenticated && pathname.startsWith('/admin/dashboard')) {
       router.replace('/admin');
     }
  }, [isAuthenticated, pathname, router]);

  const handleLoginSuccess = () => {
    window.localStorage.setItem('adminAuthenticated', 'true');
    setIsAuthenticated(true);
    router.replace('/admin/dashboard');
  };
  
  const handleLogout = () => {
    window.localStorage.removeItem('adminAuthenticated');
    setIsAuthenticated(false);
    router.replace('/');
  };

  if (isAuthenticated === null) {
    return <Loading />;
  }

  // If on a dashboard route but not authenticated, show loading while redirecting
  if (!isAuthenticated && pathname.startsWith('/admin/dashboard')) {
     return <Loading />;
  }
  
  // If on the login page but already authenticated, show loading while redirecting
  if (isAuthenticated && pathname === '/admin') {
      return <Loading />;
  }

  if (pathname.startsWith('/admin/dashboard')) {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <Header title="Admin Portal" onLogout={handleLogout} />
        <main className="flex flex-1 flex-col items-center justify-center p-4">
          {children}
        </main>
      </div>
    );
  }

  // Render login page for /admin or if not authenticated
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Admin Portal" />
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <AdminLoginPage onLoginSuccess={handleLoginSuccess} />
      </main>
    </div>
  );
}


export default function AdminLayout({ children }: { children: ReactNode }) {
    return (
        <AdminLayoutContent>{children}</AdminLayoutContent>
    );
}
