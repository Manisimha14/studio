import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AttendanceProvider } from '@/context/AttendanceContext';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'GeoAttendance MVP',
  description: 'A modern attendance system using geolocation.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('min-h-screen bg-background font-sans antialiased', inter.variable)}>
        <AttendanceProvider>
          {children}
          <Toaster />
        </AttendanceProvider>
      </body>
    </html>
  );
}
