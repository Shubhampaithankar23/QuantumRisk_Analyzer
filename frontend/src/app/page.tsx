'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import {
  Server,
  ShieldAlert,
  ShieldCheck,
  Radio,
  FileCheck2,
  FileText,
  UploadCloud,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { DashboardStats, fetchApi } from '@/lib/api';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchApi<{ success: boolean; data: DashboardStats }>('/dashboard/stats');
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err);
      setError(err.message || 'Cannot connect to backend assessment server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const totalRiskCount =
    (stats?.riskDistribution.critical || 0) +
    (stats?.riskDistribution.high || 0) +
    (stats?.riskDistribution.medium || 0) +
    (stats?.riskDistribution.low || 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        title="Post-Quantum Security Dashboard"
        subtitle="A simple overview of your institution's preparation for post-quantum cryptography."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadStats}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1.5 transition"
              title="Refresh Dashboard"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              href="/scan-import"
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md flex items-center gap-1.5 shadow-sm transition"
            >
              <Radio className="w-3.5 h-3.5" />
              Scan a Website
            </Link>
          </div>
        }
      />

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {error && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadStats}
              className="px-2.5 py-1 font-medium bg-amber-100 hover:bg-amber-200 rounded border border-amber-300 text-amber-900"
            >
              Retry
            </button>
          </div>
        )}

        {/* 1. Clear Quick Action Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">What would you like to do?</h2>
            <p className="text-xs text-slate-500">Pick a straightforward action to get started.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Link
              href="/scan-import"
              className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg flex items-center justify-center gap-2 transition"
            >
              <Radio className="w-4 h-4 text-emerald-600" />
              <span>Check a Website</span>
            </Link>
            <Link
              href="/scan-import"
              className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg flex items-center justify-center gap-2 transition"
            >
              <UploadCloud className="w-4 h-4 text-blue-600" />
              <span>Import Assets (CSV/Excel)</span>
            </Link>
            <Link
              href="/reports"
              className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg flex items-center justify-center gap-2 transition"
            >
              <FileText className="w-4 h-4 text-purple-600" />
              <span>Get PDF Report</span>
            </Link>
          </div>
        </div>

        {/* 2. Top 4 Clean Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Systems */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-medium text-slate-500">Total Systems Registered</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-slate-900">
                {stats?.totalAssets ?? 0}
              </span>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Servers & Sites
              </span>
            </div>
            <Link
              href="/assets"
              className="mt-3 text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
            >
              Manage Systems &rarr;
            </Link>
          </div>

          {/* Assessed */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-medium text-slate-500">Assessment Coverage</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-slate-900">
                {stats?.assessmentProgress ?? 0}%
              </span>
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                {stats?.assessedAssets ?? 0} Evaluated
              </span>
            </div>
            <Link
              href="/assessments"
              className="mt-3 text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
            >
              Run Assessments &rarr;
            </Link>
          </div>

          {/* Quantum-Vulnerable */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-medium text-slate-500">Vulnerable to Quantum Computers</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-red-600">
                {stats?.highRiskAssets ?? 0}
              </span>
              <span className="text-xs text-red-700 font-semibold bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                Action Needed
              </span>
            </div>
            <Link
              href="/findings"
              className="mt-3 text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1"
            >
              Review Vulnerabilities &rarr;
            </Link>
          </div>

          {/* Ready / Safe */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-medium text-slate-500">Quantum-Safe or Low Risk</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-emerald-600">
                {stats?.riskDistribution.low ?? 0}
              </span>
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                Strong Security
              </span>
            </div>
            <Link
              href="/recommendations"
              className="mt-3 text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
            >
              View Guidance &rarr;
            </Link>
          </div>
        </div>

        {/* 3. Simple Visual Status Bar */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Overall Quantum Risk Breakdown</h3>
              <p className="text-slate-500">Based on official NIST Post-Quantum Standards.</p>
            </div>
            <span className="text-slate-500 font-medium">
              {totalRiskCount} total cryptographic elements checked
            </span>
          </div>

          {/* Segmented bar */}
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
            {totalRiskCount > 0 ? (
              <>
                <div
                  style={{
                    width: `${((stats?.riskDistribution.critical || 0) / totalRiskCount) * 100}%`,
                  }}
                  className="bg-red-500 h-full"
                  title={`Critical: ${stats?.riskDistribution.critical}`}
                />
                <div
                  style={{
                    width: `${((stats?.riskDistribution.high || 0) / totalRiskCount) * 100}%`,
                  }}
                  className="bg-orange-500 h-full"
                  title={`High: ${stats?.riskDistribution.high}`}
                />
                <div
                  style={{
                    width: `${((stats?.riskDistribution.medium || 0) / totalRiskCount) * 100}%`,
                  }}
                  className="bg-amber-400 h-full"
                  title={`Medium: ${stats?.riskDistribution.medium}`}
                />
                <div
                  style={{
                    width: `${((stats?.riskDistribution.low || 0) / totalRiskCount) * 100}%`,
                  }}
                  className="bg-emerald-500 h-full"
                  title={`Low/Safe: ${stats?.riskDistribution.low}`}
                />
              </>
            ) : (
              <div className="w-full bg-slate-200 h-full" />
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
              <strong>{stats?.riskDistribution.critical || 0}</strong> Critical (Legacy Broken)
            </span>
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />
              <strong>{stats?.riskDistribution.high || 0}</strong> High (RSA / ECDSA / ECDHE)
            </span>
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
              <strong>{stats?.riskDistribution.medium || 0}</strong> Medium (AES-128 Transition)
            </span>
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              <strong>{stats?.riskDistribution.low || 0}</strong> Quantum-Safe (AES-256 / Post-Quantum)
            </span>
          </div>
        </div>

        {/* 4. Two Simple Side-by-Side Cards: Recent Scans & Recommended Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Recent Scans */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-600" />
                  Recent Scans
                </h3>
                <Link
                  href="/scan-import"
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold"
                >
                  New Scan &rarr;
                </Link>
              </div>

              <div className="mt-3 divide-y divide-slate-100">
                {stats?.recentScans && stats.recentScans.length > 0 ? (
                  stats.recentScans.slice(0, 4).map((scan) => (
                    <div key={scan.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-slate-900 font-mono">
                          {scan.targetHost}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {scan.tlsVersionNegotiated || 'TLS 1.2/1.3'} • {scan.certPubKeyAlgo || 'Certificate'}{' '}
                          {scan.certKeySize ? `(${scan.certKeySize}b)` : ''}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {scan.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No scans performed yet. Enter a website hostname to test.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 mt-3 text-right">
              <Link
                href="/scan-import"
                className="text-xs text-slate-600 hover:text-slate-900 font-medium"
              >
                Go to Scanner &rarr;
              </Link>
            </div>
          </div>

          {/* Right: What You Need To Do */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Priority Next Steps
                </h3>
                <Link
                  href="/recommendations"
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold"
                >
                  All Actions &rarr;
                </Link>
              </div>

              <div className="mt-3 space-y-3">
                {stats?.urgentRecommendations && stats.urgentRecommendations.length > 0 ? (
                  stats.urgentRecommendations.slice(0, 3).map((rec) => (
                    <div
                      key={rec.id}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{rec.finding.asset.name}</span>
                        <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">
                          Migrate
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px]">
                        Change: <span className="font-mono text-red-600">{rec.finding.algorithmOrConfig}</span>{' '}
                        &rarr; <span className="font-mono text-emerald-700 font-semibold">{rec.recommendedAlgorithm}</span>
                      </p>
                      <p className="text-slate-500 text-[11px] line-clamp-1">{rec.rationale}</p>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    All evaluated systems are currently low risk.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 mt-3 text-right">
              <Link
                href="/recommendations"
                className="text-xs text-slate-600 hover:text-slate-900 font-medium"
              >
                View full step-by-step migration guide &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
