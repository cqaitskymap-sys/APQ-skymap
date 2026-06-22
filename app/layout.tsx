import './globals.css';
import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/auth-context';
import { LoadingProvider } from '@/contexts/loading-context';
import { FirebaseSetupBanner } from '@/components/layout/firebase-setup-banner';
import { SystemSettingsProvider } from '@/contexts/system-settings-context';
import { MaintenanceBanner } from '@/components/layout/maintenance-banner';
import { MaintenanceGuard } from '@/components/layout/maintenance-guard';

export const metadata: Metadata = {
  title: 'Skymap QMS — Enterprise Quality Management System',
  description: 'Skymap Pharmaceuticals QMS — GMP, FDA, WHO compliant. Built by Satyajit Patri.',
  icons: {
    icon: '/logo-1.png',
    apple: '/logo-1.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/_next/static/css/app/layout.css" precedence="next" />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <LoadingProvider>
            <AuthProvider>
              <SystemSettingsProvider>
                <FirebaseSetupBanner />
                <MaintenanceBanner />
                <MaintenanceGuard>
                  {children}
                </MaintenanceGuard>
                <Toaster richColors position="top-right" />
              </SystemSettingsProvider>
            </AuthProvider>
          </LoadingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
