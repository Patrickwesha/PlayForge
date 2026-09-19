import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppNav } from '@/components/AppNav';
import { SyncProvider } from '@/sync/SyncProvider';

export const metadata: Metadata = {
  title: 'PlayForge',
  description: 'Football play, formation, and playbook designer with print-ready NFL-style sheets.',
};

/** Pinch on the canvas zooms the field, not the page. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <AppNav />
        <div className="flex-1 flex flex-col min-h-0">{children}</div>
        <SyncProvider />
      </body>
    </html>
  );
}
