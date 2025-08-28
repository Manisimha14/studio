
'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/Header';
import { AttendanceProvider, useAttendance, type AttendanceRecord } from '@/context/AttendanceContext';
import AdminLoginPage from './page'; 
import Loading from '../loading';

function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const { records } = useAttendance();
  const memoizedRecords = useMemo(() => records, [records]);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Admin Portal" />
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        {children && (children as React.ReactElement).type.name === 'AdminDashboard'
          ? <AdminDashboard records={memoizedRecords} />
          : children}
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
    return <AdminLoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // This is a placeholder for the actual dashboard content passed as children
  // It will be replaced by the actual page content by Next.js router
  const DashboardComponent = require('./dashboard/page').default;

  return (
    <AdminDashboardLayout>
       <DashboardComponent records={[]} />
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
