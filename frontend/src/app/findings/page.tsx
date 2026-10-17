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

  // Edit Finding State
  const [editingFinding, setEditingFinding] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState('OPEN');
  const [editOwner, setEditOwner] = useState('');
  const [editPriority, setEditPriority] = useState('HIGH');
  const [editDueDate, setEditDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewDetailFinding, setViewDetailFinding] = useState<any | null>(null);

  const fetchFindings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (riskLevel !== 'ALL') params.set('riskLevel', riskLevel);
      if (status !== 'ALL') params.set('status', status);
      if (purpose !== 'ALL') params.set('purpose', purpose);

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
  }, [search, riskLevel, status, purpose]);

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

  return (
    <div className="min-h-screen">
      <Header
        title="Cryptographic Vulnerability Findings"
        subtitle="Granular evaluation of quantum-vulnerable primitives with remediation assignment and status tracking."
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Filters and Search Bar */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search findings by algorithm, title, asset name, or rationale..."
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
              <option value="HASH_FUNCTION">Hash Functions</option>
            </select>

            <button
              onClick={fetchFindings}
              className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50"
              title="Refresh Findings"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Findings Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Finding & Affected Asset</th>
                  <th className="py-3 px-4">Algorithm / Configuration</th>
                  <th className="py-3 px-4">Purpose</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Status & Assignee</th>
                  <th className="py-3 px-4">Confidence</th>
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
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {f.algorithmOrConfig}
                        </span>
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

                      <td className="py-3 px-4">
                        {f.confidence === 'NEEDS_VERIFICATION' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Needs Verification
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">Verified</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewDetailFinding(f)}
                            className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-navy-900 border border-slate-200 rounded hover:bg-slate-50"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => handleOpenEdit(f)}
                            className="p-1.5 text-navy-900 hover:bg-slate-100 rounded"
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

      {/* Detail Modal */}
      {viewDetailFinding && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full p-6 border border-slate-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div>
                <span
                  className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded border mb-1 ${getRiskBadgeClasses(
                    viewDetailFinding.riskLevel
                  )}`}
                >
                  {viewDetailFinding.riskLevel} RISK
                </span>
                <h3 className="font-semibold text-slate-900 text-sm">{viewDetailFinding.title}</h3>
                <p className="font-mono text-xs text-slate-500">
                  {viewDetailFinding.asset?.name} ({viewDetailFinding.asset?.identifier})
                </p>
              </div>
              <button
                onClick={() => setViewDetailFinding(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Why This Configuration Is Risky</span>
                <p className="p-3 bg-red-50 text-red-900 rounded border border-red-200 mt-1 leading-relaxed">
                  {viewDetailFinding.riskReason}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px]">Technical Standard Reference</span>
                  <span className="font-semibold text-slate-800">{viewDetailFinding.standardRef}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Evidence Source</span>
                  <span className="font-medium text-slate-800">{viewDetailFinding.evidenceSource}</span>
                </div>
              </div>

              {viewDetailFinding.recommendations?.[0] && (
                <div className="p-3.5 bg-emerald-50 rounded border border-emerald-200 text-emerald-900 space-y-1">
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
                  className="px-3 py-1.5 bg-navy-900 text-white rounded font-medium hover:bg-navy-850"
                >
                  Update Status / Assign
                </button>
                <button
                  onClick={() => setViewDetailFinding(null)}
                  className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Remediation Status Modal */}
      {editingFinding && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900 text-sm">
                Update Finding Remediation Status
              </h3>
              <button
                onClick={() => setEditingFinding(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFinding} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Status *</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-200 bg-white"
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
                  placeholder="e.g. Identity Services Team, Network Admin"
                  value={editOwner}
                  onChange={(e) => setEditOwner(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Priority</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-slate-200 bg-white"
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
                    className="w-full px-3 py-2 rounded border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingFinding(null)}
                  className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-navy-900 hover:bg-navy-850 text-white rounded font-medium disabled:opacity-50"
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
