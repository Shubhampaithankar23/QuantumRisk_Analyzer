'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, LogIn, LogOut, User } from 'lucide-react';
import { getCurrentUser, logout } from '@/lib/api';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
  }, []);

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    router.push('/login');
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3">
          {actions}

          <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
            {currentUser ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 text-xs">
                  <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold">
                    {currentUser.name?.[0] || 'A'}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 leading-tight">
                      {currentUser.name || 'Admin'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[120px]">
                      {currentUser.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-600" />
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
