'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import {
  AlertTriangle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Edit2,
  X,
  ExternalLink,
  RefreshCw,
  User,
  Calendar,
  Sparkles,
  Radio,
  FileText,
  HelpCircle,
  Hash,
  Shield,
  Layers,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react';
import { formatDate, getRiskBadgeClasses, getStatusBadgeClasses } from '@/lib/utils';
import { fetchApi } from '@/lib/api';

export default function FindingsPage() {
  const [findings, setFindings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [riskLevel, setRiskLevel] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [purpose, setPurpose] = useState('ALL');
  const [evidenceSource, setEvidenceSource] = useState('ALL');

  // Edit Finding State
  const [editingFinding, setEditingFinding] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState('OPEN');
  const [editOwner, setEditOwner] = useState('');
  const [editPriority, setEditPriority] = useState('HIGH');
  const [editDueDate, setEditDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewDetailFinding, setViewDetailFinding] = useState<any | null>(null);
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  const fetchFindings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (riskLevel !== 'ALL') params.set('riskLevel', riskLevel);
      if (status !== 'ALL') params.set('status', status);
      if (purpose !== 'ALL') params.set('purpose', purpose);
      if (evidenceSource !== 'ALL') params.set('evidenceSource', evidenceSource);

      const res = await fetchApi<{ success: boolean; data: any[] }>(
        `/findings?${params.toString()}`
      );
      if (res.success) {
        setFindings(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching findings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFindings();
  }, [search, riskLevel, status, purpose, evidenceSource]);

  const handleOpenEdit = (finding: any) => {
    setEditingFinding(finding);
    setEditStatus(finding.status || 'OPEN');
    setEditOwner(finding.owner || '');
    setEditPriority(finding.priority || 'HIGH');
    setEditDueDate(finding.dueDate ? finding.dueDate.split('T')[0] : '');
  };

  const handleSaveFinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFinding) return;
    setSaving(true);

    try {
      await fetchApi(`/findings/${editingFinding.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: editStatus,
          owner: editOwner || null,
          priority: editPriority,
          dueDate: editDueDate || null,
        }),
      });

      setEditingFinding(null);
      fetchFindings();
    } catch (err: any) {
      alert(`Failed to update finding: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const renderProvenanceBadge = (source: string) => {
    switch (source) {
      case 'scanner_verified':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
            <Radio className="w-2.5 h-2.5 text-emerald-600" />
            Live Scan Verified
          </span>
        );
      case 'user_reported':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <HelpCircle className="w-2.5 h-2.5 text-amber-600" />
            Manual (Unverified)
          </span>
        );
      case 'imported':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-300">
            <FileText className="w-2.5 h-2.5 text-blue-600" />
            Imported Record
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {source}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        title="Cryptographic Vulnerability Findings"
        subtitle="Granular evaluation of quantum-vulnerable primitives with strict evidence traceability and remediation tracking."
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Filters and Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search findings by algorithm, rule ID, title, asset name, or rationale..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-navy-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
              className="py-2 px-3 rounded-md border border-slate-200 bg-white text-slate-700"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical Risk</option>
              <option value="HIGH">High Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="LOW">Low Risk</option>
            </select>

            <select
              value={evidenceSource}
              onChange={(e) => setEvidenceSource(e.target.value)}
              className="py-2 px-3 rounded-md border border-slate-200 bg-white text-slate-700"
            >
              <option value="ALL">All Data Provenance</option>
              <option value="scanner_verified">📡 Live Scan Verified</option>
              <option value="user_reported">✍️ Manual (Unverified)</option>
              <option value="imported">📁 Imported Record</option>
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="py-2 px-3 rounded-md border border-slate-200 bg-white text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="ACCEPTED_RISK">Accepted Risk</option>
            </select>

            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="py-2 px-3 rounded-md border border-slate-200 bg-white text-slate-700"
            >
              <option value="ALL">All Purposes</option>
              <option value="DIGITAL_SIGNATURE">Digital Signatures</option>
              <option value="KEY_ESTABLISHMENT">Key Establishment</option>
              <option value="SYMMETRIC_ENCRYPTION">Symmetric Encryption</option>
              <option value="PROTOCOL">Protocols & Handshakes</option>
            </select>

            <button
              onClick={fetchFindings}
              className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50 transition"
              title="Refresh Findings"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Findings Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Finding & Affected Asset</th>
                  <th className="py-3 px-4">Algorithm / Configuration</th>
                  <th className="py-3 px-4">Provenance & Evidence</th>
                  <th className="py-3 px-4">Purpose</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Remediation Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading && findings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 mx-auto animate-spin text-slate-300" />
                      <p className="mt-2 text-xs">Loading vulnerability findings...</p>
                    </td>
                  </tr>
                ) : findings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <AlertTriangle className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                      <p className="mt-2 text-xs font-medium text-slate-600">No findings matching filters</p>
                      <p className="text-[11px] text-slate-400">
                        Adjust filters or run the assessment engine to discover cryptographic findings.
                      </p>
                    </td>
                  </tr>
                ) : (
                  findings.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 max-w-xs">
                        <p className="font-semibold text-slate-900 leading-tight">{f.title}</p>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {f.asset?.name} ({f.asset?.identifier})
                        </p>
                        {f.ruleId && (
                          <span className="inline-block mt-1 font-mono text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                            Rule: {f.ruleId}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {f.algorithmOrConfig}
                        </span>
                        {f.observedValue && f.observedValue !== f.algorithmOrConfig && (
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            Observed: {f.observedValue}
                          </p>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div>
                          {renderProvenanceBadge(f.evidenceSource)}
                          {f.evidence?.hashDigest && (
                            <p className="font-mono text-[9px] text-slate-400 mt-1 truncate max-w-[120px]" title={`SHA-256: ${f.evidence.hashDigest}`}>
                              SHA: {f.evidence.hashDigest.slice(0, 10)}...
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-[10px] uppercase font-medium text-slate-600">
                          {f.purpose.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskBadgeClasses(
                            f.riskLevel
                          )}`}
                        >
                          {f.riskLevel}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${getStatusBadgeClasses(
                            f.status
                          )}`}
                        >
                          {f.status.replace(/_/g, ' ')}
                        </span>
                        {f.owner ? (
                          <p className="text-[10px] text-slate-500 mt-0.5 truncate flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" /> {f.owner}
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-400 mt-0.5 italic">Unassigned</p>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setViewDetailFinding(f);
                              setShowRawPayload(false);
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-navy-900 border border-slate-200 rounded hover:bg-slate-50 transition"
                          >
                            Evidence & Details
                          </button>
                          <button
                            onClick={() => handleOpenEdit(f)}
                            className="p-1.5 text-navy-900 hover:bg-slate-100 rounded transition"
                            title="Update Status / Assign"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Comprehensive Finding & Cryptographic Evidence Detail Modal */}
      {viewDetailFinding && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 border border-slate-200 max-h-[88vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded border ${getRiskBadgeClasses(
                      viewDetailFinding.riskLevel
                    )}`}
                  >
                    {viewDetailFinding.riskLevel} RISK
                  </span>
                  {renderProvenanceBadge(viewDetailFinding.evidenceSource)}
                </div>
                <h3 className="font-bold text-slate-900 text-sm">{viewDetailFinding.title}</h3>
                <p className="font-mono text-xs text-slate-500">
                  {viewDetailFinding.asset?.name} ({viewDetailFinding.asset?.identifier})
                </p>
              </div>
              <button
                onClick={() => setViewDetailFinding(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Risk Reason */}
            <div>
              <span className="text-slate-400 block text-[11px] font-medium">Why This Primitive Is Quantum-Vulnerable</span>
              <p className="p-3 bg-red-50 text-red-900 rounded-lg border border-red-200 mt-1 text-xs leading-relaxed">
                {viewDetailFinding.riskReason}
              </p>
            </div>

            {/* Cryptographic Standards & Rules Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Standard Basis</span>
                <span className="font-bold text-slate-800">{viewDetailFinding.standardRef || 'NIST FIPS'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Rule Identifier</span>
                <span className="font-mono font-semibold text-slate-800">{viewDetailFinding.ruleId || 'NIST-RULE'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Purpose</span>
                <span className="font-semibold text-slate-800">{viewDetailFinding.purpose.replace(/_/g, ' ')}</span>
              </div>
            </div>

            {/* Evidence & Cryptographic Proof Section */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  Audit Evidence & Provenance Traceability
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Evidence ID: {viewDetailFinding.evidenceId || viewDetailFinding.evidence?.id || 'Direct'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Observed Property</span>
                  <span className="font-mono text-slate-800 font-semibold">
                    {viewDetailFinding.evidence?.observedProperty || 'Configured Primitive'}
                  </span>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Observed Value</span>
                  <span className="font-mono text-slate-800 font-semibold">
                    {viewDetailFinding.observedValue || viewDetailFinding.evidence?.observedValue || viewDetailFinding.algorithmOrConfig}
                  </span>
                </div>
              </div>

              {viewDetailFinding.evidence?.hashDigest && (
                <div className="p-2 bg-white rounded border border-slate-200 flex items-center justify-between text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">SHA-256 Integrity Hash</span>
                    <span className="font-mono text-slate-800 text-[10px] break-all">
                      {viewDetailFinding.evidence.hashDigest}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(viewDetailFinding.evidence.hashDigest)}
                    className="ml-2 p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 shrink-0"
                    title="Copy Integrity Hash"
                  >
                    {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}

              {viewDetailFinding.evidence?.scannerVersion && (
                <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1">
                  <span>Scanner Telemetry: <strong className="text-slate-800">{viewDetailFinding.evidence.scannerVersion}</strong></span>
                  {viewDetailFinding.evidence.verifiedAt && (
                    <span>Verified: {formatDate(viewDetailFinding.evidence.verifiedAt)}</span>
                  )}
                </div>
              )}

              {/* Collapsible Raw Scanner Payload */}
              {viewDetailFinding.evidence?.rawPayload && (
                <div className="pt-1">
                  <button
                    onClick={() => setShowRawPayload(!showRawPayload)}
                    className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
                  >
                    {showRawPayload ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    {showRawPayload ? 'Hide Raw Scanner Payload' : 'View Raw Scanner Payload'}
                  </button>

                  {showRawPayload && (
                    <pre className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-lg text-[10px] font-mono overflow-x-auto max-h-48 border border-slate-800">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(viewDetailFinding.evidence.rawPayload), null, 2);
                        } catch {
                          return viewDetailFinding.evidence.rawPayload;
                        }
                      })()}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {/* Scope Limitations Alert if recorded */}
            {viewDetailFinding.limitations && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-xs">
                <span className="font-bold block text-[11px]">Assessment Scope & Limitations:</span>
                <p className="text-[11px] mt-0.5 leading-relaxed">{viewDetailFinding.limitations}</p>
              </div>
            )}

            {/* Recommended Action */}
            {viewDetailFinding.recommendations?.[0] && (
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 space-y-1">
                <span className="font-bold block text-sm">
                  Recommended Action: {viewDetailFinding.recommendations[0].recommendedAlgorithm}
                </span>
                <p className="text-xs text-emerald-800">
                  {viewDetailFinding.recommendations[0].rationale}
                </p>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <button
                onClick={() => {
                  handleOpenEdit(viewDetailFinding);
                  setViewDetailFinding(null);
                }}
                className="px-3.5 py-1.5 bg-navy-900 text-white rounded-lg font-medium text-xs hover:bg-navy-850 transition"
              >
                Update Remediation Status
              </button>
              <button
                onClick={() => setViewDetailFinding(null)}
                className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Remediation Status Modal */}
      {editingFinding && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">
                Update Remediation Status
              </h3>
              <button
                onClick={() => setEditingFinding(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFinding} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Remediation Status *</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="OPEN">Open (Unresolved)</option>
                  <option value="IN_PROGRESS">In Progress (Active Migration)</option>
                  <option value="RESOLVED">Resolved (Post-Quantum Deployed)</option>
                  <option value="ACCEPTED_RISK">Accepted Risk (Documented Exception)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Responsible Owner / Team</label>
                <input
                  type="text"
                  placeholder="e.g. Identity Services Team, Infrastructure Ops"
                  value={editOwner}
                  onChange={(e) => setEditOwner(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Priority</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Remediation Due Date</label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingFinding(null)}
                  className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-navy-900 hover:bg-navy-850 text-white rounded-lg font-medium disabled:opacity-50 transition"
                >
                  {saving ? 'Saving...' : 'Save Remediation Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
