import { Suspense } from 'react';
import { PrintClient } from './PrintClient';

export const metadata = { title: 'Print - PlayForge' };

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading&hellip;</div>}>
      <PrintClient />
    </Suspense>
  );
}
