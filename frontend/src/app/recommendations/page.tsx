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
  ChevronDown,
  ChevronUp,
  FileCheck2,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
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
    <div className="min-h-screen bg-slate-50">
      <Header
        title="Upgrade Recommendations"
        subtitle="Plain-language guidance on which algorithms to upgrade and what to replace them with."
        actions={
          <button
            onClick={fetchRecommendations}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Simple Top Banner */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
              Official NIST Standards (FIPS 203, 204, 205)
            </span>
            <h2 className="text-base font-bold text-slate-900 mt-1">
              Direct Post-Quantum Migration Paths
            </h2>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Classical algorithms like RSA and ECDSA can be broken once quantum computers become available.
              Below are the exact standardized replacements recommended for your systems.
            </p>
          </div>
        </div>

        {/* Clean Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-700 mr-1">Filter by Type:</span>
          {[
            { id: 'ALL', label: 'All Recommendations' },
            { id: 'DIGITAL_SIGNATURE', label: 'Digital Signatures (e.g. RSA / ECDSA)' },
            { id: 'KEY_ESTABLISHMENT', label: 'Key Exchange (e.g. ECDHE)' },
            { id: 'SYMMETRIC_ENCRYPTION', label: 'Symmetric Ciphers (e.g. AES)' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterPurpose(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterPurpose === item.id
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Cards List */}
        {loading && recommendations.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-xl border border-slate-200 text-xs">
            <RefreshCw className="w-6 h-6 mx-auto animate-spin text-slate-300 mb-2" />
            Loading recommendations...
          </div>
        ) : filteredRecs.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-xl border border-slate-200 text-xs">
            <Lightbulb className="w-8 h-8 mx-auto text-slate-300 stroke-1 mb-2" />
            <p className="font-medium text-slate-600">No recommendations under this filter.</p>
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

              const isLowRisk = rec.finding.riskLevel === 'LOW';

              return (
                <div
                  key={rec.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 hover:border-slate-300 transition"
                >
                  {/* Top Bar: System & Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 text-xs">
                    <div>
                      <span className="font-bold text-slate-900 text-sm">
                        {rec.finding.asset?.name}
                      </span>
                      <span className="text-slate-400 font-mono ml-2">
                        ({rec.finding.asset?.identifier})
                      </span>
                    </div>

                    <span
                      className={`self-start sm:self-auto px-2.5 py-0.5 rounded text-[11px] font-bold ${
                        isLowRisk
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {isLowRisk ? '🟢 Quantum-Safe' : '🔴 Action Required'}
                    </span>
                  </div>

                  {/* Clean Visual Before -> After */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 font-medium block text-[11px]">Current Algorithm:</span>
                      <span className="font-mono font-bold text-red-600 text-sm mt-0.5 block">
                        {rec.finding.algorithmOrConfig}
                      </span>
                      <span className="text-slate-500 text-[11px] block mt-0.5">
                        Function: {rec.finding.purpose?.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 font-medium block text-[11px]">Target Replacement:</span>
                      <span className="font-mono font-bold text-emerald-700 text-sm mt-0.5 block">
                        {rec.recommendedAlgorithm}
                      </span>
                      <span className="text-emerald-700 font-medium text-[11px] block mt-0.5">
                        Standard: {rec.standardRef}
                      </span>
                    </div>
                  </div>

                  {/* Plain Language Explanation */}
                  <div className="space-y-2 text-xs">
                    <div>
                      <strong className="text-slate-900">Why is this needed?</strong>
                      <p className="text-slate-600 mt-0.5 leading-relaxed bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
                        {rec.finding.riskReason}
                      </p>
                    </div>

                    <div>
                      <strong className="text-slate-900">Why this replacement?</strong>
                      <p className="text-slate-600 mt-0.5 leading-relaxed bg-emerald-50/40 p-2.5 rounded-lg border border-emerald-100">
                        {rec.whyAppropriate || rec.rationale}
                      </p>
                    </div>
                  </div>

                  {/* Expand Checklist Button */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
                    <button
                      onClick={() => toggleExpand(rec.id)}
                      className="font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                    >
                      {isExpanded ? (
                        <>
                          Hide Step-by-Step Guide <ChevronUp className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          Show Step-by-Step Upgrade Steps ({steps.length} steps) <ChevronDown className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    <Link
                      href="/findings"
                      className="text-slate-500 hover:text-slate-800 font-medium"
                    >
                      Assign Task &rarr;
                    </Link>
                  </div>

                  {/* Expandable Simple Steps */}
                  {isExpanded && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-3 animate-in fade-in duration-150">
                      <strong className="text-slate-900 block">How to complete this migration:</strong>
                      <div className="space-y-2">
                        {steps.map((step, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 text-slate-700">
                            <span className="w-5 h-5 rounded-full bg-navy-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="leading-relaxed">{step}</span>
                          </div>
                        ))}
                      </div>

                      {rec.compatibilityNotes && (
                        <div className="mt-3 pt-3 border-t border-slate-200 text-[11px] text-slate-600">
                          <strong className="text-slate-800">Compatibility note:</strong>{' '}
                          {rec.compatibilityNotes}
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
