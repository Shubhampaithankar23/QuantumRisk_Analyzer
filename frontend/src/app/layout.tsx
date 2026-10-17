import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'PQ Readiness — Post-Quantum Security Assessment Platform',
  description:
    'Institutional cryptographic risk evaluation and NIST Post-Quantum migration platform for universities, colleges, and research institutions.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
            <main className="flex-1 pb-16">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
