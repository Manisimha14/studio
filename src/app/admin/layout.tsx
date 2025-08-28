
'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/Header';
import { AttendanceProvider, useAttendance } from '@/context/AttendanceContext';
import AdminLoginPage from './page';
import Loading from '../loading';
import AdminDashboard from './dashboard/page';

function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const { records } = useAttendance();

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Admin Portal" />
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <AdminDashboard records={records} />
      </main>
    </div>
  );
}


function AdminContent() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const session = window.localStorage.getItem('adminAuthenticated');
    setIsAuthenticated(session === 'true');
  }, [pathname]);

  if (isAuthenticated === null) {
    return <Loading />;
  }
  
  const handleLoginSuccess = () => {
    window.localStorage.setItem('adminAuthenticated', 'true');
    setIsAuthenticated(true);
  };

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
    <AdminDashboardLayout>
       <AdminDashboard records={[]} />
    </AdminDashboardLayout>
  );
}


export default function AdminLayout({ children }: { children: ReactNode }) {
    return (
        <AttendanceProvider>
            <AdminContent />
        </AttendanceProvider>
    );
}
