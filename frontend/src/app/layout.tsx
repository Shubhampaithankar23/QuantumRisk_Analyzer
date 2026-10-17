import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/AppShell';

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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
