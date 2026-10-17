'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import {
  Settings,
  Shield,
  Building,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  BookOpen,
  History,
  Lock,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { fetchApi } from '@/lib/api';

export default function SettingsPage() {
  const [institution, setInstitution] = useState<any | null>(null);
  const [rules, setRules] = useState<any | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [instRes, rulesRes, logsRes] = await Promise.all([
        fetchApi<{ success: boolean; data: any }>('/system/institution'),
        fetchApi<{ success: boolean; data: any }>('/system/rules'),
        fetchApi<{ success: boolean; data: any[] }>('/system/audit-logs'),
      ]);

      if (instRes.success) setInstitution(instRes.data);
      if (rulesRes.success) setRules(rulesRes.data);
      if (logsRes.success) setAuditLogs(logsRes.data);
    } catch (err: any) {
      console.error('Error loading settings data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="min-h-screen">
      <Header
        title="Platform Settings & Standards Reference"
        subtitle="Institutional parameters, official NIST PQC standards specifications, and security audit log."
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Section 1: Institution Profile */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Building className="w-4 h-4 text-slate-600" />
              Registered Institutional Entity
            </h2>
            <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-0.5 rounded border border-emerald-200">
              Active Organization
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Institution Name</span>
              <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                {institution?.name || 'Apex University of Science & Technology'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Domain Authority</span>
              <span className="font-mono font-semibold text-slate-800 text-sm mt-0.5 block">
                {institution?.domain || 'apex.edu'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Security Contact</span>
              <span className="text-slate-700 text-sm mt-0.5 block">
                {institution?.contactEmail || 'infosec@apex.edu'}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: NIST Post-Quantum Standards Matrix */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-pqgreen-600" />
                NIST Post-Quantum Cryptography (PQC) Standards Matrix
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Engine Version: {rules?.engineVersion || '2024.1-NIST-FIPS'} • Official FIPS Publication: August 2024
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {rules?.standards?.map((std: any) => (
              <div
                key={std.id}
                className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2 flex flex-col justify-between"
              >
                <div>
                  <span className="font-bold text-navy-900 font-mono text-xs block">{std.name}</span>
                  <span className="text-[11px] font-semibold text-pqgreen-700 block mt-0.5">
                    {std.targetClass}
                  </span>
                  <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">{std.purpose}</p>
                </div>

                <div className="pt-2 border-t border-slate-200 text-[10px]">
                  <span className="text-slate-400 block font-medium">Standardized Algorithms:</span>
                  <p className="font-mono font-semibold text-slate-800 mt-0.5">
                    {std.recommendedAlgorithms?.join(', ')}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Engine Core Principles */}
          <div className="mt-4 p-4 rounded-md bg-slate-50 border border-slate-200 text-xs space-y-2">
            <span className="font-semibold text-slate-900 block">Assessment Engine Core Rules:</span>
            <ul className="space-y-1 text-slate-600 list-disc list-inside leading-relaxed text-[11px]">
              {rules?.principles?.map((p: string, idx: number) => (
                <li key={idx}>{p}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Section 3: Administrative Audit Trail */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-600" />
                Administrative & Assessment Audit Trail
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Immutable event log recording scans, imports, assessments, and finding status modifications.
              </p>
            </div>
            <button
              onClick={loadData}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">Action Event</th>
                  <th className="py-2.5 px-3">Entity Type</th>
                  <th className="py-2.5 px-3">Details</th>
                  <th className="py-2.5 px-3">IP Address</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900 font-mono">
                        {log.action}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                          {log.entityType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 max-w-md truncate">
                        {log.details || 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{formatDate(log.timestamp)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
