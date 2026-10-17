'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import {
  Server,
  ShieldAlert,
  AlertTriangle,
  Clock,
  ArrowRight,
  Radio,
  FileCheck2,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { formatDate, getRiskBadgeClasses } from '@/lib/utils';
import { DashboardStats, fetchApi } from '@/lib/api';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchApi<{ success: boolean; data: DashboardStats }>(
        '/dashboard/stats'
      );
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err);
      setError(err.message || 'Failed to connect to backend assessment service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const totalRiskCount =
    stats &&
    (stats.riskDistribution.critical +
      stats.riskDistribution.high +
      stats.riskDistribution.medium +
      stats.riskDistribution.low);

  return (
    <div className="min-h-screen">
      <Header
        title="Institutional Cryptographic Posture"
        subtitle="Post-quantum security assessment, quantum-vulnerable algorithm inventory, and NIST migration roadmap."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadStats}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              href="/scan-import"
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-navy-900 hover:bg-navy-850 rounded-md flex items-center gap-1.5 shadow-sm transition"
            >
              <Radio className="w-3.5 h-3.5 text-pqgreen-400" />
              New TLS Scan
            </Link>
          </div>
        }
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {error && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start justify-between">
            <div>
              <p className="font-semibold text-sm">Backend Service Notice</p>
              <p className="text-xs text-amber-800 mt-0.5">{error}</p>
            </div>
            <button
              onClick={loadStats}
              className="px-3 py-1 text-xs font-medium bg-amber-100 hover:bg-amber-200 text-amber-900 rounded border border-amber-300"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Top 4 Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Assets
              </span>
              <div className="p-2 rounded-md bg-slate-100 text-slate-600">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {stats?.totalAssets ?? 0}
              </span>
              <span className="text-xs text-slate-500">registered systems</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Assessed Assets
              </span>
              <div className="p-2 rounded-md bg-emerald-50 text-emerald-600">
                <FileCheck2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {stats?.assessedAssets ?? 0}
              </span>
              <span className="text-xs text-emerald-700 font-medium">
                ({stats?.assessmentProgress ?? 0}% completed)
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                High Risk Assets
              </span>
              <div className="p-2 rounded-md bg-red-50 text-red-600">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-red-600">
                {stats?.highRiskAssets ?? 0}
              </span>
              <span className="text-xs text-slate-500">quantum vulnerable</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Pending Assessments
              </span>
              <div className="p-2 rounded-md bg-amber-50 text-amber-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {stats?.pendingAssessments ?? 0}
              </span>
              <span className="text-xs text-slate-500">awaiting evaluation</span>
            </div>
          </div>
        </div>

        {/* Middle Section: Assessment Progress & Risk Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Assessment Progress */}
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              Institutional Assessment Progress
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Percentage of digital assets evaluated against NIST FIPS 203/204/205 standards.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1.5">
                  <span>Coverage Rate</span>
                  <span>{stats?.assessmentProgress ?? 0}%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-navy-900 transition-all duration-500 rounded-full"
                    style={{ width: `${stats?.assessmentProgress ?? 0}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block">Evaluated:</span>
                  <span className="font-semibold text-slate-800">
                    {stats?.assessedAssets ?? 0} of {stats?.totalAssets ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Evaluation Target:</span>
                  <span className="font-semibold text-slate-800">100% Core Systems</span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/assessments"
                  className="text-xs font-medium text-navy-800 hover:text-navy-900 flex items-center gap-1"
                >
                  Run Assessment Engine <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Simple Risk Distribution */}
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Risk Level Distribution (Active Findings)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Categorized by cryptographic impact under Shor\'s and Grover\'s algorithms.
                </p>
              </div>
              <Link
                href="/findings"
                className="text-xs font-medium text-slate-600 hover:text-navy-900 flex items-center gap-1"
              >
                View Findings <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="mt-6 space-y-3">
              {/* Critical */}
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm bg-red-600 inline-block" />
                    Critical Risk (Immediate Shor / Broken Legacy)
                  </span>
                  <span className="font-semibold text-slate-900">
                    {stats?.riskDistribution.critical ?? 0}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-600 rounded-full"
                    style={{
                      width: totalRiskCount
                        ? `${((stats?.riskDistribution.critical || 0) / totalRiskCount) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>

              {/* High */}
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm bg-orange-500 inline-block" />
                    High Risk (RSA / ECDSA / ECDHE / SNDL Exposure)
                  </span>
                  <span className="font-semibold text-slate-900">
                    {stats?.riskDistribution.high ?? 0}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 rounded-full"
                    style={{
                      width: totalRiskCount
                        ? `${((stats?.riskDistribution.high || 0) / totalRiskCount) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>

              {/* Medium */}
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                    Medium Risk (AES-128 / Classical Transition)
                  </span>
                  <span className="font-semibold text-slate-900">
                    {stats?.riskDistribution.medium ?? 0}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{
                      width: totalRiskCount
                        ? `${((stats?.riskDistribution.medium || 0) / totalRiskCount) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>

              {/* Low */}
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                    Low / Quantum-Resistant (AES-256 / SHA-384 / Hybrid)
                  </span>
                  <span className="font-semibold text-slate-900">
                    {stats?.riskDistribution.low ?? 0}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{
                      width: totalRiskCount
                        ? `${((stats?.riskDistribution.low || 0) / totalRiskCount) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
            </div>

            {(!totalRiskCount || totalRiskCount === 0) && (
              <div className="mt-4 p-3 rounded bg-slate-50 text-slate-500 text-xs text-center border border-slate-200">
                No active findings recorded. Run an assessment on registered assets or perform a TLS scan.
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section: Recent Scans & Top Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Scans */}
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Radio className="w-4 h-4 text-slate-500" />
                Recent TLS Inspections
              </h2>
              <Link
                href="/scan-import"
                className="text-xs font-medium text-navy-800 hover:text-navy-900 flex items-center gap-1"
              >
                Scan Manager <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="mt-3 divide-y divide-slate-100">
              {stats?.recentScans && stats.recentScans.length > 0 ? (
                stats.recentScans.map((scan) => (
                  <div key={scan.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-900 font-mono">
                        {scan.targetHost}:{scan.port}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-slate-500">
                        <span>{scan.tlsVersionNegotiated || 'Pending'}</span>
                        <span>•</span>
                        <span>
                          {scan.certPubKeyAlgo ? `${scan.certPubKeyAlgo} (${scan.certKeySize}b)` : 'Cert info'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded border ${
                          scan.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {scan.status}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {formatDate(scan.completedAt || scan.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400">
                  <Radio className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                  <p className="text-xs mt-2">No authorized scans performed yet.</p>
                  <Link
                    href="/scan-import"
                    className="inline-block mt-2 text-xs font-medium text-navy-800 hover:underline"
                  >
                    Launch your first scan &rarr;
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Urgent Recommendations */}
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Priority Migration Recommendations
              </h2>
              <Link
                href="/recommendations"
                className="text-xs font-medium text-navy-800 hover:text-navy-900 flex items-center gap-1"
              >
                All Actions <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="mt-3 divide-y divide-slate-100">
              {stats?.urgentRecommendations && stats.urgentRecommendations.length > 0 ? (
                stats.urgentRecommendations.map((rec) => (
                  <div key={rec.id} className="py-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">
                        {rec.finding.asset.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${getRiskBadgeClasses(
                          rec.finding.riskLevel
                        )}`}
                      >
                        {rec.finding.riskLevel}
                      </span>
                    </div>
                    <p className="text-slate-600 font-mono text-[11px]">
                      Current: {rec.finding.algorithmOrConfig} &rarr; Target:{' '}
                      <span className="font-semibold text-pqgreen-700">
                        {rec.recommendedAlgorithm}
                      </span>
                    </p>
                    <p className="text-slate-500 line-clamp-1">{rec.rationale}</p>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400">
                  <ShieldCheck className="w-8 h-8 mx-auto text-emerald-400 stroke-1" />
                  <p className="text-xs mt-2">No urgent migration actions pending.</p>
                  <p className="text-[11px] text-slate-400">
                    Run an assessment across your assets to generate recommendations.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
