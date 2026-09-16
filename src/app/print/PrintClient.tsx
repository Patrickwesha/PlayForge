'use client';

import dynamic from 'next/dynamic';

const PrintPage = dynamic(() => import('@/print/PrintPage'), { ssr: false });

export function PrintClient() {
  return <PrintPage />;
}
