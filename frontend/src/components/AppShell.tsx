'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { getAuthToken } from '@/lib/api';
import { Lock, RefreshCw } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = getAuthToken();

    if (isLoginPage) {
      if (token) {
        // Already logged in, direct to dashboard
        router.replace('/');
      } else {
        setCheckingAuth(false);
        setIsAuthenticated(false);
      }
      return;
    }

    // Protected pages: require valid token
    if (!token) {
      setIsAuthenticated(false);
      setCheckingAuth(false);
      router.replace('/login');
    } else {
      setIsAuthenticated(true);
      setCheckingAuth(false);
    }
  }, [pathname, isLoginPage, router]);

  // Login page layout
  if (isLoginPage) {
    return <main className="min-h-screen bg-navy-950 flex flex-col">{children}</main>;
  }

  // Security guard splash screen while verifying or redirecting
  if (checkingAuth || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-navy-900 border border-navy-800 rounded-2xl p-8 text-center shadow-2xl space-y-4">
          <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl mx-auto flex items-center justify-center text-emerald-400">
            <Lock className="w-6 h-6 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white tracking-tight">
              Institutional Security Verification
            </h2>
            <p className="text-xs text-slate-400">
              Verifying session credentials...
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 pt-2 font-mono">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Redirecting to Authentication...
          </div>
        </div>
      </div>
    );
  }

  // Authenticated layout
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <main className="flex-1 pb-16">{children}</main>
      </div>
    </div>
  );
}
