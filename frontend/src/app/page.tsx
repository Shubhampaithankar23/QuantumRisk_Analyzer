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
  Trash2,
  Clock,
  Layers,
  FileCode,
  Shield,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { DashboardStats, fetchApi } from '@/lib/api';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingScanId, setDeletingScanId] = useState<string | null>(null);

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

  const handleDeleteScan = async (id: string, host: string) => {
    if (!confirm(`Are you sure you want to cut/remove recent scan for "${host}"?`)) return;
    setDeletingScanId(id);
    try {
      const res = await fetchApi<any>(`/scans/${id}`, { method: 'DELETE' });
      if (res.success) {
        await loadStats();
      }
    } catch (err: any) {
      alert(`Failed to delete scan: ${err.message || 'Error occurred'}`);
    } finally {
      setDeletingScanId(null);
    }
  };

  const handleClearAllScans = async () => {
    if (!confirm('Are you sure you want to cut/clear all recent scan records?')) return;
    try {
      const res = await fetchApi<any>('/scans', { method: 'DELETE' });
      if (res.success) {
        await loadStats();
      }
    } catch (err: any) {
      alert(`Failed to clear scans: ${err.message || 'Error occurred'}`);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const totalRiskCount =
    (stats?.riskDistribution?.critical || 0) +
    (stats?.riskDistribution?.high || 0) +
    (stats?.riskDistribution?.medium || 0) +
    (stats?.riskDistribution?.low || 0);

  const remStats = stats?.remediationStats || {
    open: 0,
    inProgress: 0,
    resolved: 0,
    acceptedRisk: 0,
    total: 0,
    progressPct: 0,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        title="Post-Quantum Security Dashboard"
        subtitle="Cryptographically verified readiness metrics based on NIST FIPS 203, 204, and 205 standards."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadStats}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1.5 transition shadow-sm"
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
        {/* Error State Banner */}
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
            <h2 className="text-sm font-bold text-slate-900">Immediate Assessment Actions</h2>
            <p className="text-xs text-slate-500">Perform a safe live scan, import cryptography records, or view official reports.</p>
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
              href="/assessments"
              className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg flex items-center justify-center gap-2 transition"
            >
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
              <span>Run NIST Engine</span>
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
                DB-Recorded
              </span>
            </div>
            <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between">
              <span>{stats?.sourceDistribution?.liveScanned ?? 0} Live Scanned</span>
              <Link
                href="/assets"
                className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
              >
                Manage &rarr;
              </Link>
            </div>
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
            <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between">
              <span>{stats?.pendingAssessments ?? 0} Pending</span>
              <Link
                href="/assessments"
                className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
              >
                Assessments &rarr;
              </Link>
            </div>
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
            <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between">
              <span>{(stats?.riskDistribution?.critical ?? 0) + (stats?.riskDistribution?.high ?? 0)} Active Findings</span>
              <Link
                href="/findings?riskLevel=HIGH"
                className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1"
              >
                Review &rarr;
              </Link>
            </div>
          </div>

          {/* Ready / Safe */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-medium text-slate-500">Quantum-Safe or Low Risk</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-emerald-600">
                {stats?.riskDistribution?.low ?? 0}
              </span>
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                Strong Security
              </span>
            </div>
            <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Post-Quantum Ready</span>
              <Link
                href="/recommendations"
                className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
              >
                Guidance &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* 3. Provenance & Telemetry Separation: Live Scanned vs Manual vs Imported */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                Data Provenance & Telemetry Separation
              </h3>
              <p className="text-xs text-slate-500">
                Rule-enforced separation: Live cryptographic observations are never conflated with self-reported manual entries.
              </p>
            </div>
            <span className="text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1 rounded border border-slate-200 font-mono">
              Integrity Verified
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Live TLS Scan Verified */}
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-emerald-600" />
                  Live TLS Scanned
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Scanner-Verified
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-2xl font-extrabold text-emerald-900">
                  {stats?.sourceDistribution?.liveScanned ?? 0}
                </span>
                <span className="text-xs text-emerald-700">
                  {stats?.evidenceStats?.scannerVerified ?? 0} Evidence Hashes
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Observed directly via SSLyze 6.3.1 TLS handshakes and pinned IP connections. High confidence.
              </p>
            </div>

            {/* Manual User Reported */}
            <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                  Manual Entries
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-300">
                  user_reported (Unverified)
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-2xl font-extrabold text-amber-900">
                  {stats?.sourceDistribution?.manual ?? 0}
                </span>
                <span className="text-xs text-amber-700">
                  {stats?.evidenceStats?.userReported ?? 0} Self-Reported
                </span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Entered manually by analysts. Explicitly labelled unverified and never presented as scanner proof.
              </p>
            </div>

            {/* File Imports */}
            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                  Imported Inventory
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-800 border border-blue-300">
                  Imported Records
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-2xl font-extrabold text-blue-900">
                  {stats?.sourceDistribution?.imported ?? 0}
                </span>
                <span className="text-xs text-blue-700">
                  {stats?.evidenceStats?.imported ?? 0} Inventory Items
                </span>
              </div>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                Imported from CSV/Excel asset registers with structured validation and integrity logging.
              </p>
            </div>
          </div>
        </div>

        {/* 4. Missing Information / Incomplete Assets Warning (Honest Unknown beats Fake Result) */}
        {stats?.missingInfo && stats.missingInfo.count > 0 && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {stats.missingInfo.count} system(s) have missing cryptographic telemetry or unassessed parameters
                </span>
              </div>
              <span className="text-[10px] font-semibold bg-amber-200/60 text-amber-900 px-2 py-0.5 rounded">
                Unverifiable &rarr; NOT_ASSESSED
              </span>
            </div>
            <p className="text-amber-800 text-[11px] leading-relaxed">
              Per strict assessment rules, systems with missing key exchange groups or unobserved certificates are not given fabricated scores.
              Run a safe live scan or provide cryptographic parameters to assess their readiness.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {stats.missingInfo.assets.map((item) => (
                <div
                  key={item.id}
                  className="px-2.5 py-1 bg-white/80 rounded border border-amber-300 text-[11px] font-mono flex items-center gap-2"
                >
                  <span className="font-semibold text-slate-800">{item.name}</span>
                  <span className="text-slate-400">({item.identifier})</span>
                  <span className="text-[9px] px-1 py-0.2 bg-amber-100 text-amber-800 rounded">
                    {item.assessmentStatus}
                  </span>
                </div>
              ))}
              <Link
                href="/scan-import"
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium text-[11px] flex items-center gap-1 transition"
              >
                Scan Now &rarr;
              </Link>
            </div>
          </div>
        )}

        {/* 5. Simple Visual Status Bar: Overall Quantum Risk Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Overall Quantum Risk Breakdown</h3>
              <p className="text-slate-500">Calculated from individual cryptographic findings against NIST FIPS standards.</p>
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
                    width: `${((stats?.riskDistribution?.critical || 0) / totalRiskCount) * 100}%`,
                  }}
                  className="bg-red-500 h-full"
                  title={`Critical: ${stats?.riskDistribution?.critical}`}
                />
                <div
                  style={{
                    width: `${((stats?.riskDistribution?.high || 0) / totalRiskCount) * 100}%`,
                  }}
                  className="bg-orange-500 h-full"
                  title={`High: ${stats?.riskDistribution?.high}`}
                />
                <div
                  style={{
                    width: `${((stats?.riskDistribution?.medium || 0) / totalRiskCount) * 100}%`,
                  }}
                  className="bg-amber-400 h-full"
                  title={`Medium: ${stats?.riskDistribution?.medium}`}
                />
                <div
                  style={{
                    width: `${((stats?.riskDistribution?.low || 0) / totalRiskCount) * 100}%`,
                  }}
                  className="bg-emerald-500 h-full"
                  title={`Low/Safe: ${stats?.riskDistribution?.low}`}
                />
              </>
            ) : (
              <div className="w-full bg-slate-200 h-full" />
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
            <Link
              href="/findings?riskLevel=CRITICAL"
              className="flex items-center gap-1.5 text-slate-700 hover:text-red-700 transition"
            >
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
              <strong>{stats?.riskDistribution?.critical || 0}</strong> Critical (Static RSA Transport / Broken)
            </Link>
            <Link
              href="/findings?riskLevel=HIGH"
              className="flex items-center gap-1.5 text-slate-700 hover:text-orange-700 transition"
            >
              <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />
              <strong>{stats?.riskDistribution?.high || 0}</strong> High (RSA / ECDSA / Classical ECDHE)
            </Link>
            <Link
              href="/findings?riskLevel=MEDIUM"
              className="flex items-center gap-1.5 text-slate-700 hover:text-amber-700 transition"
            >
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
              <strong>{stats?.riskDistribution?.medium || 0}</strong> Medium (AES-128 Transition)
            </Link>
            <Link
              href="/findings?riskLevel=LOW"
              className="flex items-center gap-1.5 text-slate-700 hover:text-emerald-700 transition"
            >
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              <strong>{stats?.riskDistribution?.low || 0}</strong> Quantum-Safe (AES-256 / Post-Quantum KEM)
            </Link>
          </div>
        </div>

        {/* 6. Remediation Tracking Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Vulnerability Remediation Tracking
              </h3>
              <p className="text-xs text-slate-500">
                Track migration progress from classical vulnerable primitives to NIST post-quantum standards.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">
                {remStats.progressPct}% Addressed
              </span>
              <Link
                href="/findings"
                className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold"
              >
                Manage Tasks &rarr;
              </Link>
            </div>
          </div>

          {/* Remediation Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
              {remStats.total > 0 ? (
                <>
                  <div
                    style={{ width: `${(remStats.resolved / remStats.total) * 100}%` }}
                    className="bg-emerald-500 h-full"
                    title={`Resolved: ${remStats.resolved}`}
                  />
                  <div
                    style={{ width: `${(remStats.acceptedRisk / remStats.total) * 100}%` }}
                    className="bg-blue-500 h-full"
                    title={`Accepted Risk: ${remStats.acceptedRisk}`}
                  />
                  <div
                    style={{ width: `${(remStats.inProgress / remStats.total) * 100}%` }}
                    className="bg-amber-400 h-full"
                    title={`In Progress: ${remStats.inProgress}`}
                  />
                  <div
                    style={{ width: `${(remStats.open / remStats.total) * 100}%` }}
                    className="bg-slate-300 h-full"
                    title={`Open: ${remStats.open}`}
                  />
                </>
              ) : (
                <div className="w-full bg-slate-200 h-full" />
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
              <Link
                href="/findings?status=OPEN"
                className="p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
              >
                <span className="text-slate-500 text-[11px] block">Open (Pending)</span>
                <span className="text-lg font-bold text-slate-900">{remStats.open}</span>
              </Link>
              <Link
                href="/findings?status=IN_PROGRESS"
                className="p-3 bg-amber-50/50 hover:bg-amber-50 rounded-lg border border-amber-200 transition"
              >
                <span className="text-amber-800 text-[11px] block">In Progress</span>
                <span className="text-lg font-bold text-amber-900">{remStats.inProgress}</span>
              </Link>
              <Link
                href="/findings?status=RESOLVED"
                className="p-3 bg-emerald-50/50 hover:bg-emerald-50 rounded-lg border border-emerald-200 transition"
              >
                <span className="text-emerald-800 text-[11px] block">Resolved (PQ Deployed)</span>
                <span className="text-lg font-bold text-emerald-900">{remStats.resolved}</span>
              </Link>
              <Link
                href="/findings?status=ACCEPTED_RISK"
                className="p-3 bg-blue-50/50 hover:bg-blue-50 rounded-lg border border-blue-200 transition"
              >
                <span className="text-blue-800 text-[11px] block">Accepted Risk</span>
                <span className="text-lg font-bold text-blue-900">{remStats.acceptedRisk}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 7. Two Simple Side-by-Side Cards: Recent Scans & Recommended Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Recent Scans */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-600" />
                  Recent Scans & Status
                </h3>
                <div className="flex items-center gap-2">
                  {stats?.recentScans && stats.recentScans.length > 0 && (
                    <button
                      onClick={handleClearAllScans}
                      className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 hover:bg-red-50 px-2 py-0.5 rounded border border-red-200 transition"
                      title="Cut / Remove all recent scans"
                    >
                      <Trash2 className="w-3 h-3" />
                      Cut All
                    </button>
                  )}
                  <Link
                    href="/scan-import"
                    className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold"
                  >
                    New Scan &rarr;
                  </Link>
                </div>
              </div>

              <div className="mt-3 divide-y divide-slate-100">
                {stats?.recentScans && stats.recentScans.length > 0 ? (
                  stats.recentScans.slice(0, 6).map((scan) => (
                    <div
                      key={scan.id}
                      className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 px-2 rounded -mx-2 transition"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900 font-mono">
                            {scan.targetHost}
                          </p>
                          <span className="text-[10px] text-slate-400 font-mono">:{scan.port}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {scan.tlsVersionNegotiated || 'TLS 1.2/1.3'} • {scan.certPubKeyAlgo || 'Certificate'}{' '}
                          {scan.certKeySize ? `(${scan.certKeySize}b)` : ''}
                          {scan.evidenceCount ? ` • ${scan.evidenceCount} evidence items` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${
                            scan.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : scan.status === 'RUNNING'
                              ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
                              : scan.status === 'FAILED'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {scan.status}
                        </span>
                        <button
                          onClick={() => handleDeleteScan(scan.id, scan.targetHost)}
                          disabled={deletingScanId === scan.id}
                          className="px-2 py-1 rounded text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition flex items-center gap-1"
                          title="Cut / Remove this recent scan"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-600" />
                          <span className="text-[11px] font-medium text-slate-600 hover:text-red-600">Cut</span>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No scans performed yet. Enter a website hostname to test.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">
                {stats?.scanStats?.total ?? 0} total scans recorded in DB
              </span>
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
                          {rec.urgency || 'MIGRATE'}
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
                    All evaluated systems are currently low risk or quantum-ready.
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
