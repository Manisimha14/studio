import type { Metadata } from 'next';
import './globals.css';
import { AttendanceProvider } from '@/context/AttendanceContext';
import { Toaster } from '@/components/ui/toaster';

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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <AttendanceProvider>
          {children}
          <Toaster />
        </AttendanceProvider>
      </body>
    </html>
  );
}
