'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import {
  FileSpreadsheet,
  Download,
  FileText,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Building,
  Calendar,
  Lock,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { fetchApi } from '@/lib/api';

export default function ReportsPage() {
  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const fetchReportSummary = async () => {
    try {
      setLoading(true);
      const res = await fetchApi<{ success: boolean; data: any }>('/reports/summary');
      if (res.success) {
        setReportData(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching report summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportSummary();
  }, []);

  const handleDownloadPdf = () => {
    setDownloading(true);
    // Directly trigger browser download of PDF endpoint
    const url = 'http://localhost:4000/api/v1/reports/export/pdf';
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pq-readiness-assessment-report.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloading(false), 2000);
  };

  const handleDownloadJson = () => {
    if (!reportData) return;
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pq-readiness-evidence-export.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Institutional Reports & Audit Exports"
        subtitle="Download official executive summaries, risk registers, and NIST-aligned remediation plans."
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Executive Report Download Action Card */}
        <div className="p-6 bg-gradient-to-r from-navy-950 via-navy-900 to-navy-850 rounded-lg text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-pqgreen-400 uppercase tracking-wider bg-pqgreen-500/10 px-2 py-0.5 rounded border border-pqgreen-500/20">
              Executive Assessment Report
            </span>
            <h2 className="text-lg font-bold text-slate-100">
              Institutional Post-Quantum Readiness Assessment Report (PDF)
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Formatted for university boards, Chief Information Officers, and security audit committees.
              Includes executive risk metrics, asset-by-asset cryptographic breakdown, NIST FIPS 203/204/205
              migration recommendations, and methodological disclaimers.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="w-full sm:w-auto px-5 py-2.5 bg-pqgreen-600 hover:bg-pqgreen-700 text-white font-semibold text-xs rounded-md shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {downloading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download PDF Report
                </>
              )}
            </button>

            <button
              onClick={handleDownloadJson}
              className="w-full sm:w-auto px-4 py-2.5 bg-navy-800 hover:bg-navy-750 text-slate-200 text-xs font-medium rounded-md border border-navy-700 flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4 text-slate-400" />
              Export JSON Data
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-slate-400 text-[11px] block">Target Institution</span>
            <span className="text-sm font-bold text-slate-900 mt-1 block truncate">
              {reportData?.institution?.name || 'Apex University'}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Domain: {reportData?.institution?.domain || 'apex.edu'}
            </span>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-slate-400 text-[11px] block">Readiness Coverage</span>
            <span className="text-sm font-bold text-emerald-600 mt-1 block">
              {reportData?.metrics?.readinessCoveragePct ?? 0}% Core Systems Evaluated
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {reportData?.metrics?.assessedAssets} of {reportData?.metrics?.totalAssets} Assets
            </span>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-slate-400 text-[11px] block">Quantum Vulnerability Findings</span>
            <span className="text-sm font-bold text-red-600 mt-1 block">
              {reportData?.metrics?.findings?.total ?? 0} Recorded Findings
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {reportData?.metrics?.findings?.critical ?? 0} Critical • {reportData?.metrics?.findings?.high ?? 0} High Risk
            </span>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-slate-400 text-[11px] block">Evaluation Rule Version</span>
            <span className="text-sm font-bold text-slate-900 font-mono mt-1 block">
              {reportData?.ruleVersion || 'v2024.1-NIST-FIPS'}
            </span>
            <span className="text-[10px] text-pqgreen-700 font-medium block mt-0.5">
              NIST Standardized
            </span>
          </div>
        </div>

        {/* Detailed Assessment Scope and Standards Card */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Assessment Methodology & Scope Disclosure
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-2">
              <span className="font-semibold text-slate-800 block">Evaluated Threat Vectors:</span>
              <ul className="space-y-1 text-slate-600 list-disc list-inside">
                <li>
                  <strong>Shor's Algorithm:</strong> Breaks RSA factoring, Diffie-Hellman, and ECDSA discrete log.
                </li>
                <li>
                  <strong>Store Now, Decrypt Later (SNDL):</strong> Active adversary interception of key exchange traffic today for future retrospective decryption.
                </li>
                <li>
                  <strong>Grover's Algorithm:</strong> Reduces effective symmetric key strength (AES-256 retains 128-bit quantum security; AES-128 drops to 64-bit).
                </li>
              </ul>
            </div>

            <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-2">
              <span className="font-semibold text-slate-800 block">Scope Limitations:</span>
              <p className="text-slate-600 leading-relaxed">
                {reportData?.limitations ||
                  'External network and TLS scans inspect publicly observable protocol negotiations. Internal database encryption, source code cryptographic keys, and unexposed servers require internal source code and configuration audit.'}
              </p>
              <p className="text-[11px] text-slate-500 italic">
                Items labelled "Needs Verification" indicate insufficient evidence and must not be assumed secure.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
