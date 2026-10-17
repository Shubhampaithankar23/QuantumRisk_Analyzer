'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Server,
  Radio,
  FileCheck2,
  AlertTriangle,
  Lightbulb,
  FileSpreadsheet,
  Settings,
  ShieldAlert,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Assets', href: '/assets', icon: Server },
  { name: 'Scan & Import', href: '/scan-import', icon: Radio },
  { name: 'Assessments', href: '/assessments', icon: FileCheck2 },
  { name: 'Findings', href: '/findings', icon: AlertTriangle },
  { name: 'Recommendations', href: '/recommendations', icon: Lightbulb },
  { name: 'Reports', href: '/reports', icon: FileSpreadsheet },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-3 left-4 z-50">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-md bg-navy-900 text-slate-200 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-pqgreen-500"
          aria-label="Toggle Navigation"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-navy-950 border-r border-navy-850 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div className="h-16 flex items-center px-6 border-b border-navy-850 bg-navy-950/80 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-pqgreen-500/10 border border-pqgreen-500/30 flex items-center justify-center text-pqgreen-400">
              <ShieldAlert className="w-5 h-5 text-pqgreen-400" />
            </div>
            <div>
              <span className="font-semibold text-slate-100 text-sm tracking-tight flex items-center gap-1.5">
                PQ Readiness
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-pqgreen-500/10 text-pqgreen-400 border border-pqgreen-500/20">
                  FIPS 203+
                </span>
              </span>
              <p className="text-[11px] text-slate-400">Institutional Security</p>
            </div>
          </div>
        </div>

        {/* Institution Info Badge */}
        <div className="px-4 py-3 mx-3 my-3 rounded-lg bg-navy-900 border border-navy-800">
          <p className="text-xs font-medium text-slate-300 truncate">
            Apex University of Sci. & Tech.
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-pqgreen-400 animate-pulse"></span>
            <span className="text-[11px] text-slate-400">Environment Active</span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`group flex items-center justify-between px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  active
                    ? 'bg-pqgreen-500/15 text-pqgreen-300 border border-pqgreen-500/30'
                    : 'text-slate-300 hover:bg-navy-900 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      active ? 'text-pqgreen-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                {active && <ChevronRight className="w-4 h-4 text-pqgreen-400" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-navy-850 bg-navy-950/50">
          <div className="text-[11px] text-slate-400 space-y-0.5">
            <div className="flex justify-between">
              <span>Standard Engine:</span>
              <span className="text-slate-300 font-mono">NIST-2024.1</span>
            </div>
            <div className="flex justify-between">
              <span>Deployment:</span>
              <span className="text-slate-300">Local Verified</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
