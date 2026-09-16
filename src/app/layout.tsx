import type { Metadata } from 'next';
import './globals.css';
import { AppNav } from '@/components/AppNav';

export const metadata: Metadata = {
  title: 'PlayForge',
  description: 'Football play, formation, and playbook designer with print-ready NFL-style sheets.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <AppNav />
        <div className="flex-1 flex flex-col min-h-0">{children}</div>
      </body>
    </html>
  );
}
