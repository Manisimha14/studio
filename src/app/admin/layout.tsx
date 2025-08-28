
import { Header } from '@/components/Header';
import { AttendanceProvider } from '@/context/AttendanceContext';
import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
    return (
        <AttendanceProvider>
            <div className="flex min-h-screen w-full flex-col">
            <Header title="Admin Portal" />
            <main className="flex flex-1 flex-col items-center justify-center p-4">
            {children}
            </main>
            </div>
        </AttendanceProvider>
    );
}
