'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import {
  FileCheck2,
  Play,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Clock,
  CheckCircle2,
  X,
  ExternalLink,
  Layers,
  Radio,
  FileText,
  HelpCircle,
  Calculator,
} from 'lucide-react';
import { formatDate, getStatusBadgeClasses, getRiskBadgeClasses } from '@/lib/utils';
import { fetchApi } from '@/lib/api';

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningBatch, setRunningBatch] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<any | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchAssessments = async () => {
    try {
      setLoading(true);
      const res = await fetchApi<{ success: boolean; data: any[] }>('/assessments');
      if (res.success) {
        setAssessments(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching assessments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, []);

  const handleRunAll = async () => {
    try {
      setRunningBatch(true);
      setNotice(null);
      const res = await fetchApi<any>('/assessments/run-all', { method: 'POST' });
      if (res.success) {
        setNotice(res.message || 'Batch evaluation completed successfully.');
        fetchAssessments();
      }
    } catch (err: any) {
      setNotice(`Assessment execution failed: ${err.message}`);
    } finally {
      setRunningBatch(false);
    }
  };

  const handleViewAssessment = async (id: string) => {
    try {
      const res = await fetchApi<any>(`/assessments/${id}`);
      if (res.success) {
        setSelectedAssessment(res.data);
      }
    } catch (err: any) {
      alert(`Failed to load assessment details: ${err.message}`);
    }
  };

  const renderProvenanceBadge = (source?: string) => {
    switch (source) {
      case 'scanner_verified':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
            <Radio className="w-2.5 h-2.5 text-emerald-600" />
            Scanner-Verified
          </span>
        );
      case 'user_reported':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <HelpCircle className="w-2.5 h-2.5 text-amber-600" />
            Manual Entry
          </span>
        );
      case 'imported':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-800 border border-blue-300">
            <FileText className="w-2.5 h-2.5 text-blue-600" />
            Imported Record
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        title="Post-Quantum Cryptographic Assessments"
        subtitle="Deterministic rules-based assessment against NIST FIPS 203, FIPS 204, and FIPS 205 standards."
        actions={
          <button
            onClick={handleRunAll}
            disabled={runningBatch}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-navy-900 hover:bg-navy-850 rounded-lg flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
          >
            {runningBatch ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-pqgreen-400" />
                Evaluating All Assets...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-pqgreen-400 fill-pqgreen-400" />
                Run Engine on All Assets
              </>
            )}
          </button>
        }
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {notice && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{notice}</span>
            </div>
            <button onClick={() => setNotice(null)} className="text-emerald-600 hover:text-emerald-800">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Rules Engine Standard Summary Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-pqgreen-700 uppercase tracking-wider bg-pqgreen-50 px-2 py-0.5 rounded border border-pqgreen-200">
              Evaluation Engine: v2024.1-NIST-FIPS
            </span>
            <h3 className="text-sm font-bold text-slate-900 pt-1">
              Deterministic Purpose-Specific Evaluation Standard
            </h3>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Cryptographic primitives are audited according to functional purpose: Digital Signatures
              are evaluated against ML-DSA (FIPS 204), Key Establishment against ML-KEM (FIPS 203), and
              Symmetric Ciphers against Grover-resistant AES-256 (FIPS 197). An honest unknown beats a fake result.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 shrink-0">
            <div>
              <span className="text-slate-400 block text-[10px]">Evaluated Assets</span>
              <span className="font-bold text-slate-900 text-sm">{assessments.length}</span>
            </div>
            <div className="border-l border-slate-200 pl-3">
              <span className="text-slate-400 block text-[10px]">Standard Basis</span>
              <span className="font-bold text-slate-900 text-sm">NIST FIPS 203/204/205</span>
            </div>
          </div>
        </div>

        {/* Assessments List Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Assessment Log & Asset Scores
            </h3>
            <button
              onClick={fetchAssessments}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Asset Under Assessment</th>
                  <th className="py-3 px-4">Asset Type</th>
                  <th className="py-3 px-4">Data Sensitivity</th>
                  <th className="py-3 px-4">Quantum Risk Score</th>
                  <th className="py-3 px-4">Readiness Status</th>
                  <th className="py-3 px-4">Findings Count</th>
                  <th className="py-3 px-4">Assessed At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading && assessments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 mx-auto animate-spin text-slate-300" />
                      <p className="mt-2 text-xs">Loading assessments...</p>
                    </td>
                  </tr>
                ) : assessments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <FileCheck2 className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                      <p className="mt-2 text-xs font-medium text-slate-600">No assessments executed</p>
                      <p className="text-[11px] text-slate-400">
                        Click "Run Engine on All Assets" above to perform an automated evaluation.
                      </p>
                    </td>
                  </tr>
                ) : (
                  assessments.map((item) => {
                    const isInconclusive =
                      item.overallReadinessStatus === 'INSUFFICIENT_EVIDENCE' ||
                      item.overallReadinessStatus === 'NOT_ASSESSED';

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">{item.asset?.name}</p>
                          <p className="font-mono text-[11px] text-slate-500">{item.asset?.identifier}</p>
                        </td>

                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                            {item.asset?.assetType?.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-700 border border-slate-200">
                            {item.asset?.dataSensitivity?.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {isInconclusive ? (
                              <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                0/100 (Unassessed)
                              </span>
                            ) : (
                              <span
                                className={`font-bold font-mono text-sm ${
                                  item.quantumRiskScore >= 70
                                    ? 'text-red-600'
                                    : item.quantumRiskScore >= 40
                                    ? 'text-orange-600'
                                    : 'text-emerald-600'
                                }`}
                              >
                                {item.quantumRiskScore}/100
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${getStatusBadgeClasses(
                              item.overallReadinessStatus
                            )}`}
                          >
                            {item.overallReadinessStatus.replace(/_/g, ' ')}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {item.findings?.length || 0} findings
                        </td>

                        <td className="py-3 px-4 text-slate-500">
                          {formatDate(item.assessedAt)}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleViewAssessment(item.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-navy-900 hover:text-white hover:bg-navy-900 border border-navy-900/30 rounded-lg transition"
                          >
                            Details & Math
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Assessment Detail Modal with Score Breakdown */}
      {selectedAssessment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border mb-1 ${getStatusBadgeClasses(
                    selectedAssessment.overallReadinessStatus
                  )}`}
                >
                  {selectedAssessment.overallReadinessStatus.replace(/_/g, ' ')}
                </span>
                <h3 className="font-bold text-slate-900 text-sm">
                  {selectedAssessment.asset?.name}
                </h3>
                <p className="font-mono text-xs text-slate-500">{selectedAssessment.asset?.identifier}</p>
              </div>
              <button
                onClick={() => setSelectedAssessment(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px]">Quantum Risk Score</span>
                  <span className="text-2xl font-extrabold font-mono text-slate-900">
                    {selectedAssessment.quantumRiskScore} / 100
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Evaluation Engine Standard</span>
                  <span className="font-semibold text-slate-800">{selectedAssessment.ruleVersion}</span>
                </div>
              </div>

              {/* Score Breakdown (if present) */}
              {selectedAssessment.scoreBreakdown && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-900 text-[11px] flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                    Weighted Scoring Calculation Breakdown
                  </span>
                  {(() => {
                    let breakdown: any = {};
                    try {
                      breakdown = typeof selectedAssessment.scoreBreakdown === 'string'
                        ? JSON.parse(selectedAssessment.scoreBreakdown)
                        : selectedAssessment.scoreBreakdown;
                    } catch {
                      breakdown = {};
                    }

                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div className="p-2 bg-white rounded border border-slate-200">
                          <span className="text-slate-400 block text-[10px]">Key Exchange</span>
                          <span className="font-mono font-bold text-slate-800">
                            +{breakdown.keyExchangePenalty ?? 0} pts
                          </span>
                        </div>
                        <div className="p-2 bg-white rounded border border-slate-200">
                          <span className="text-slate-400 block text-[10px]">Digital Signature</span>
                          <span className="font-mono font-bold text-slate-800">
                            +{breakdown.signaturePenalty ?? 0} pts
                          </span>
                        </div>
                        <div className="p-2 bg-white rounded border border-slate-200">
                          <span className="text-slate-400 block text-[10px]">Symmetric Cipher</span>
                          <span className="font-mono font-bold text-slate-800">
                            +{breakdown.symmetricPenalty ?? 0} pts
                          </span>
                        </div>
                        <div className="p-2 bg-white rounded border border-slate-200">
                          <span className="text-slate-400 block text-[10px]">Protocol Penalty</span>
                          <span className="font-mono font-bold text-slate-800">
                            +{breakdown.protocolPenalty ?? 0} pts
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <h4 className="font-bold text-slate-800 mb-1">Executive Summary</h4>
                <p className="p-3 bg-slate-50 text-slate-700 rounded-xl border border-slate-200 leading-relaxed text-[11px]">
                  {selectedAssessment.summary}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-2">
                  Identified Cryptographic Findings ({selectedAssessment.findings?.length || 0})
                </h4>
                <div className="space-y-2">
                  {selectedAssessment.findings?.map((f: any) => (
                    <div
                      key={f.id}
                      className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{f.title}</span>
                          {renderProvenanceBadge(f.evidenceSource || f.evidence?.evidenceSource)}
                        </div>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded border ${getRiskBadgeClasses(
                            f.riskLevel
                          )}`}
                        >
                          {f.riskLevel}
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">{f.riskReason}</p>
                      {f.recommendations?.[0] && (
                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-emerald-700">
                            Recommended: {f.recommendations[0].recommendedAlgorithm}
                          </span>
                          <span className="text-slate-400 text-[10px]">{f.recommendations[0].standardRef}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-200">
                <button
                  onClick={() => setSelectedAssessment(null)}
                  className="px-4 py-1.5 bg-navy-900 text-white rounded-lg text-xs font-semibold hover:bg-navy-850 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
