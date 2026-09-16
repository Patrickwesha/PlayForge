import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="max-w-3xl mx-auto w-full p-10 text-center">
      <div className="text-5xl font-bold mb-2">404</div>
      <p className="text-neutral-600 mb-4">That page does not exist.</p>
      <Link href="/" className="underline">Back to PlayForge</Link>
    </main>
  );
}
