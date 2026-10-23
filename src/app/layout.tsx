import type { Metadata } from 'next';
import { Bricolage_Grotesque, Geist, Geist_Mono } from 'next/font/google';
import { AppProvider } from '@/lib/store';
import { ToastProvider, themeInitScript } from '@/components/ui';
import './globals.css';
import './features.css';

// Display face for titles and big numbers; Geist for everything else
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600', '700'] });
const sans = Geist({ subsets: ['latin'], variable: '--font-sans' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Trade data extraction',
  description: 'Countries, months and files of the trade data extraction service',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The theme is set on <html> by the inline script before React hydrates
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AppProvider>
          <ToastProvider>{children}</ToastProvider>
        </AppProvider>
      </body>
    </html>
  );
}
