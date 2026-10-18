'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import {
  Download,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Building,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { fetchApi, API_BASE, getAuthToken } from '@/lib/api';

export default function ReportsPage() {
  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReportSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchApi<{ success: boolean; data: any }>('/reports/summary');
      if (res.success) {
        setReportData(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching report summary:', err);
      setError(err.message || 'Failed to fetch report summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportSummary();
  }, []);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const token = getAuthToken();
      const url = `${API_BASE}/reports/export/pdf`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        throw new Error(`Report generation failed with HTTP status ${res.status}`);
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `pq-readiness-assessment-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert(`PDF Download Error: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadJson = () => {
    if (!reportData) return;
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pq-readiness-evidence-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        title="Assessment Reports"
        subtitle="Generate and download institutional post-quantum readiness reports from stored database evidence."
      />

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchReportSummary}
              className="px-2.5 py-1 font-medium bg-amber-100 hover:bg-amber-200 rounded border border-amber-300 text-amber-900"
            >
              Retry
            </button>
          </div>
        )}

        {/* Main PDF Download Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                Official Institutional Report
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-1">
                Post-Quantum Security Assessment (PDF)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Prepared for deans, CIOs, CISOs, and institutional audit committees.
              </p>
            </div>

            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2 transition disabled:opacity-50 shrink-0"
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
          </div>

          {/* Report Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-400 block text-[11px]">Institution</span>
              <strong className="text-slate-900 text-sm block truncate mt-0.5">
                {reportData?.institution?.name || 'Institutional Inventory'}
              </strong>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-400 block text-[11px]">Systems Evaluated</span>
              <strong className="text-emerald-700 text-sm block mt-0.5">
                {reportData?.metrics?.assessedAssets ?? 0} of {reportData?.metrics?.totalAssets ?? 0} Systems (
                {reportData?.metrics?.readinessCoveragePct ?? 0}%)
              </strong>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-400 block text-[11px]">Evaluation Rules</span>
              <strong className="text-slate-900 font-mono text-sm block mt-0.5">
                {reportData?.ruleVersion || 'NIST FIPS 203/204/205'}
              </strong>
            </div>
          </div>

          {/* What is in this report? */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
            <strong className="text-slate-900 block">What is included in this PDF report:</strong>
            <ul className="space-y-1 text-slate-600 list-disc list-inside">
              <li>Executive overview and overall institutional quantum readiness score</li>
              <li>Inventory of all evaluated websites, servers, databases, and certificates</li>
              <li>Breakdown of algorithms vulnerable to Shor's and Grover's quantum attacks</li>
              <li>NIST-standardized migration replacements (ML-DSA, ML-KEM, SLH-DSA)</li>
              <li>Scope disclosure and recommendations for internal cryptography auditing</li>
            </ul>
          </div>

          {/* Scope & Limitations Disclosure */}
          {reportData?.limitations && (
            <div className="p-3.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-xs space-y-1">
              <span className="font-bold block text-[11px]">Scope & Limitations:</span>
              <p className="text-[11px] leading-relaxed text-amber-800">{reportData.limitations}</p>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleDownloadJson}
              className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1.5 transition"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Export Raw JSON Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
