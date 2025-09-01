
'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import AdminLoginPage from './page';
import Loading from '../loading';
import AdminDashboard from './dashboard/page';

function AdminDashboardLayout({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Admin Portal" onLogout={onLogout} />
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <AdminDashboard />
      </main>
    </div>
  );
}


function AdminContent() {
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
     
     const isAuth = isAuthenticated;

    if (isAuth && pathname === '/admin') {
      router.replace('/admin/dashboard');
    } else if (!isAuth && pathname.startsWith('/admin/dashboard')) {
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
  
  if (!isAuthenticated && pathname.startsWith('/admin/dashboard')) {
     return <Loading />;
  }
  
  if (isAuthenticated && pathname === '/admin') {
      return <Loading />;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <Header title="Admin Portal" />
        <main className="flex flex-1 flex-col items-center justify-center p-4">
          <AdminLoginPage onLoginSuccess={handleLoginSuccess} />
        </main>
      </div>
    );
  }

  return (
    <AdminDashboardLayout onLogout={handleLogout}>
       <AdminDashboard />
    </AdminDashboardLayout>
  );
}


export default function AdminLayout({ children }: { children: ReactNode }) {
    return (
        <AdminContent />
    );
}
