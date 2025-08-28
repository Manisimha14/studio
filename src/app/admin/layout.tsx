"use client";

import { Header } from '@/components/Header';
import type { ReactNode } from 'react';
import { useState } from 'react';
import AdminLoginPage from './login/page';

function AdminAuth({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Admin Login" />
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <AdminLoginPage onLoginSuccess={onLoginSuccess} />
      </main>
    </div>
  );
}


export default function AdminLayout({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return (
      <AdminAuth onLoginSuccess={handleLoginSuccess} />
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Admin Dashboard" />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        {children}
      </main>
    </div>
  );
}
