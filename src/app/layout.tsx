
'use client';

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { AttendanceProvider } from '@/context/AttendanceContext';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

// Since we are using a client-side context provider, we can't export metadata from here.
// You would typically move this to a server-side parent layout if needed,
// but for this app structure, we will omit it.
/*
export const metadata: Metadata = {
  title: 'Smart Uniworld 1',
  description: 'A modern attendance system using geolocation.',
};
*/

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
