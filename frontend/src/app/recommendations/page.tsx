'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import {
  Lightbulb,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileCheck2,
} from 'lucide-react';
import { formatDate, getRiskBadgeClasses } from '@/lib/utils';
import { fetchApi } from '@/lib/api';

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPurpose, setFilterPurpose] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const res = await fetchApi<{ success: boolean; data: any[] }>('/recommendations');
      if (res.success) {
        setRecommendations(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const filteredRecs = recommendations.filter((r) => {
    if (filterPurpose === 'ALL') return true;
    return r.finding?.purpose === filterPurpose;
  });

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Direct Migration Recommendations"
        subtitle="Deterministic algorithm replacement roadmaps aligned with NIST FIPS 203, FIPS 204, and FIPS 205."
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Institutional Leadership Guidance Banner */}
        <div className="p-5 bg-gradient-to-r from-navy-900 to-navy-850 rounded-lg text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-pqgreen-400 uppercase tracking-wider bg-pqgreen-500/10 px-2 py-0.5 rounded border border-pqgreen-500/20">
              CISO & Leadership Directive
            </span>
            <h3 className="text-base font-semibold text-slate-100">
              Purpose-Aligned Post-Quantum Cryptographic Migration
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Classical public-key cryptography (RSA, ECDSA, ECDHE) must be systematically migrated
              prior to the advent of a Cryptanalytically Relevant Quantum Computer (CRQC). Encrypted key
              exchanges face immediate exposure to "Store Now, Decrypt Later" interception.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchRecommendations}
              className="px-3.5 py-1.5 bg-navy-800 hover:bg-navy-700 text-white rounded text-xs font-medium border border-navy-700 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-700">Filter by Purpose:</span>
            {['ALL', 'DIGITAL_SIGNATURE', 'KEY_ESTABLISHMENT', 'SYMMETRIC_ENCRYPTION', 'HASH_FUNCTION'].map(
              (p) => (
                <button
                  key={p}
                  onClick={() => setFilterPurpose(p)}
                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                    filterPurpose === p
                      ? 'bg-navy-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p === 'ALL'
                    ? 'All Primitives'
                    : p === 'DIGITAL_SIGNATURE'
                    ? 'Digital Signatures'
                    : p === 'KEY_ESTABLISHMENT'
                    ? 'Key Establishment'
                    : p === 'SYMMETRIC_ENCRYPTION'
                    ? 'Symmetric Ciphers'
                    : 'Hash Functions'}
                </button>
              )
            )}
          </div>

          <span className="text-xs text-slate-500">
            Showing {filteredRecs.length} actionable recommendation(s)
          </span>
        </div>

        {/* Recommendations List */}
        {loading && recommendations.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-lg border border-slate-200">
            <RefreshCw className="w-6 h-6 mx-auto animate-spin text-slate-300" />
            <p className="mt-2 text-xs">Generating algorithm recommendations...</p>
          </div>
        ) : filteredRecs.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-lg border border-slate-200">
            <Lightbulb className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
            <p className="mt-2 text-xs font-medium text-slate-600">No recommendations found</p>
            <p className="text-[11px] text-slate-400">
              Run an assessment from the Assessments tab to generate direct NIST-aligned migration roadmaps.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRecs.map((rec) => {
              const isExpanded = expandedId === rec.id;
              let steps: string[] = [];
              try {
                steps = JSON.parse(rec.migrationSteps || '[]');
              } catch {
                steps = [rec.migrationSteps];
              }

              return (
                <div
                  key={rec.id}
                  className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-slate-300"
                >
                  {/* Card Header */}
                  <div className="p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskBadgeClasses(
                            rec.finding.riskLevel
                          )}`}
                        >
                          {rec.finding.riskLevel} RISK
                        </span>
                        <span className="text-xs font-mono text-slate-500">
                          {rec.finding.asset?.name} ({rec.finding.asset?.identifier})
                        </span>
                      </div>

                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 self-start sm:self-auto">
                        Standard: {rec.standardRef}
                      </span>
                    </div>

                    {/* Migration Path: Current -> Target */}
                    <div className="p-3.5 bg-slate-50 rounded border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Current Vulnerable Primitive</span>
                        <span className="font-mono font-bold text-red-600 text-sm">
                          {rec.finding.algorithmOrConfig}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          Purpose: {rec.finding.purpose?.replace(/_/g, ' ')} • Source: {rec.finding.evidenceSource}
                        </span>
                      </div>

                      <div className="hidden sm:block text-slate-300">
                        <ArrowRight className="w-5 h-5 text-slate-400" />
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[11px]">Recommended Post-Quantum Target</span>
                        <span className="font-mono font-bold text-pqgreen-700 text-sm">
                          {rec.recommendedAlgorithm}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-medium block">
                          NIST Standardized Replacement
                        </span>
                      </div>
                    </div>

                    {/* Plain Language Rationale */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
                      <div>
                        <span className="font-semibold text-slate-900 block mb-1">
                          Why It Is Risky:
                        </span>
                        <p className="text-slate-600 leading-relaxed bg-red-50/50 p-2.5 rounded border border-red-100">
                          {rec.finding.riskReason}
                        </p>
                      </div>

                      <div>
                        <span className="font-semibold text-slate-900 block mb-1">
                          Why This Recommendation Is Appropriate:
                        </span>
                        <p className="text-slate-600 leading-relaxed bg-emerald-50/50 p-2.5 rounded border border-emerald-100">
                          {rec.whyAppropriate || rec.rationale}
                        </p>
                      </div>
                    </div>

                    {/* Expand / Collapse Action */}
                    <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                      <button
                        onClick={() => toggleExpand(rec.id)}
                        className="text-xs font-semibold text-navy-900 hover:text-navy-850 flex items-center gap-1"
                      >
                        {isExpanded ? (
                          <>
                            Hide Migration Steps & Compatibility <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            View Migration Steps & Compatibility Considerations <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>

                      <Link
                        href={`/findings`}
                        className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                      >
                        Manage in Findings &rarr;
                      </Link>
                    </div>
                  </div>

                  {/* Expanded Technical Details */}
                  {isExpanded && (
                    <div className="bg-slate-50/70 p-5 border-t border-slate-200 space-y-4 text-xs animate-in fade-in duration-200">
                      {rec.compatibilityNotes && (
                        <div>
                          <span className="font-semibold text-slate-900 block mb-1">
                            Compatibility & Operational Considerations:
                          </span>
                          <p className="text-slate-700 bg-white p-3 rounded border border-slate-200 leading-relaxed">
                            {rec.compatibilityNotes}
                          </p>
                        </div>
                      )}

                      {steps && steps.length > 0 && (
                        <div>
                          <span className="font-semibold text-slate-900 block mb-2">
                            Step-by-Step Remediation & Migration Checklist:
                          </span>
                          <div className="space-y-1.5 bg-white p-3.5 rounded border border-slate-200">
                            {steps.map((step, idx) => (
                              <div key={idx} className="flex items-start gap-2.5 text-slate-700">
                                <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-300 text-slate-700 flex items-center justify-center shrink-0 font-mono text-[10px] font-bold mt-0.5">
                                  {idx + 1}
                                </span>
                                <span className="leading-relaxed">{step}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
