'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import {
  Server,
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Clock,
  X,
  AlertTriangle,
  RefreshCw,
  Info,
} from 'lucide-react';
import { formatDate, getStatusBadgeClasses } from '@/lib/utils';
import { fetchApi } from '@/lib/api';

interface AssetRecord {
  id: string;
  name: string;
  identifier: string;
  assetType: string;
  dataSensitivity: string;
  knownAlgorithms: string | null;
  informationSource: string;
  assessmentStatus: string;
  tlsVersion: string | null;
  port: number;
  environment: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  findings?: Array<{ id: string; riskLevel: string; status: string }>;
  assessments?: Array<{ id: string; quantumRiskScore: number; overallReadinessStatus: string }>;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [assetType, setAssetType] = useState('ALL');
  const [dataSensitivity, setDataSensitivity] = useState('ALL');
  const [assessmentStatus, setAssessmentStatus] = useState('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetRecord | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [viewAsset, setViewAsset] = useState<AssetRecord | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    identifier: '',
    assetType: 'WEBSITE',
    dataSensitivity: 'CONFIDENTIAL',
    knownAlgorithms: '',
    tlsVersion: 'TLSv1.3',
    port: 443,
    environment: 'PRODUCTION',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (assetType !== 'ALL') params.set('assetType', assetType);
      if (dataSensitivity !== 'ALL') params.set('dataSensitivity', dataSensitivity);
      if (assessmentStatus !== 'ALL') params.set('assessmentStatus', assessmentStatus);

      const res = await fetchApi<{ success: boolean; data: AssetRecord[] }>(
        `/assets?${params.toString()}`
      );
      if (res.success) {
        setAssets(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching assets:', err);
      setError(err.message || 'Failed to retrieve asset inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [search, assetType, dataSensitivity, assessmentStatus]);

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      identifier: '',
      assetType: 'WEBSITE',
      dataSensitivity: 'CONFIDENTIAL',
      knownAlgorithms: '',
      tlsVersion: 'TLSv1.3',
      port: 443,
      environment: 'PRODUCTION',
      notes: '',
    });
    setFormError(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (asset: AssetRecord) => {
    setEditingAsset(asset);
    setFormData({
      name: asset.name,
      identifier: asset.identifier,
      assetType: asset.assetType,
      dataSensitivity: asset.dataSensitivity,
      knownAlgorithms: asset.knownAlgorithms || '',
      tlsVersion: asset.tlsVersion || 'TLSv1.3',
      port: asset.port,
      environment: asset.environment,
      notes: asset.notes || '',
    });
    setFormError(null);
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      if (editingAsset) {
        await fetchApi(`/assets/${editingAsset.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        await fetchApi('/assets', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      setShowAddModal(false);
      setEditingAsset(null);
      fetchAssets();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save asset record');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetchApi(`/assets/${id}`, { method: 'DELETE' });
      setDeleteConfirmId(null);
      fetchAssets();
    } catch (err: any) {
      alert(`Failed to delete asset: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Asset Inventory Management"
        subtitle="Cryptographic registry of institutional websites, servers, databases, certificates, and archival stores."
        actions={
          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-navy-900 hover:bg-navy-850 rounded-md flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus className="w-4 h-4 text-pqgreen-400" />
            Register Asset
          </button>
        }
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Filters and Search Bar */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, hostname, identifier, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-navy-900 focus:border-navy-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              className="text-xs py-2 px-3 rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-navy-900"
            >
              <option value="ALL">All Asset Types</option>
              <option value="WEBSITE">Website</option>
              <option value="SERVER">Server</option>
              <option value="APPLICATION">Application</option>
              <option value="DATABASE">Database</option>
              <option value="DIGITAL_CERTIFICATE">Digital Certificate</option>
              <option value="STORAGE_BACKUP">Storage & Backup</option>
            </select>

            <select
              value={dataSensitivity}
              onChange={(e) => setDataSensitivity(e.target.value)}
              className="text-xs py-2 px-3 rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-navy-900"
            >
              <option value="ALL">All Sensitivity</option>
              <option value="PUBLIC">Public</option>
              <option value="INTERNAL">Internal</option>
              <option value="CONFIDENTIAL">Confidential</option>
              <option value="HIGHLY_SENSITIVE">Highly Sensitive</option>
              <option value="REGULATED">Regulated (FERPA/HIPAA)</option>
            </select>

            <select
              value={assessmentStatus}
              onChange={(e) => setAssessmentStatus(e.target.value)}
              className="text-xs py-2 px-3 rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-navy-900"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Assessment</option>
              <option value="ASSESSED">Assessed</option>
              <option value="HIGH_RISK">High Risk</option>
              <option value="LOW_RISK">Low Risk</option>
            </select>

            <button
              onClick={fetchAssets}
              className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50"
              title="Refresh Asset Table"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Assets Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Asset Name & Identifier</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Sensitivity</th>
                  <th className="py-3 px-4">Cryptographic Configuration</th>
                  <th className="py-3 px-4">Evidence Source</th>
                  <th className="py-3 px-4">Readiness Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading && assets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 mx-auto animate-spin text-slate-300" />
                      <p className="mt-2 text-xs">Loading institutional assets...</p>
                    </td>
                  </tr>
                ) : assets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Server className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                      <p className="mt-2 text-xs font-medium text-slate-600">No assets found</p>
                      <p className="text-[11px] text-slate-400">
                        Register an asset above or use the Scan & Import tool to load inventories.
                      </p>
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => {
                    const latestAssessment = asset.assessments?.[0];
                    return (
                      <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">{asset.name}</p>
                          <p className="font-mono text-[11px] text-slate-500">{asset.identifier}</p>
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {asset.assetType.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${
                              asset.dataSensitivity === 'HIGHLY_SENSITIVE' ||
                              asset.dataSensitivity === 'REGULATED'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : asset.dataSensitivity === 'CONFIDENTIAL'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            {asset.dataSensitivity.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-mono text-[11px] text-slate-600 truncate">
                            {asset.knownAlgorithms ? asset.knownAlgorithms : 'Not documented'}
                          </div>
                          {asset.tlsVersion && (
                            <span className="text-[10px] text-slate-400">
                              Port {asset.port} • {asset.tlsVersion}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-600 border border-slate-200">
                            {asset.informationSource.replace('IMPORT_', 'File: ')}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${getStatusBadgeClasses(
                              latestAssessment?.overallReadinessStatus || asset.assessmentStatus
                            )}`}
                          >
                            {latestAssessment
                              ? `${latestAssessment.overallReadinessStatus.replace(/_/g, ' ')} (${latestAssessment.quantumRiskScore}/100)`
                              : asset.assessmentStatus.replace(/_/g, ' ')}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewAsset(asset)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100"
                              title="View Asset Details"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(asset)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100"
                              title="Edit Asset"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(asset.id)}
                              className="p-1.5 text-red-500 hover:text-red-700 rounded hover:bg-red-50"
                              title="Delete Asset"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* Add / Edit Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 border border-slate-200 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900 text-sm">
                {editingAsset ? 'Edit Asset Record' : 'Register New Institutional Asset'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingAsset(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Asset Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Student Identity Provider"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-navy-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Hostname or System Identifier *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. idp.university.edu"
                  value={formData.identifier}
                  onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-navy-900 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Asset Type *</label>
                  <select
                    value={formData.assetType}
                    onChange={(e) => setFormData({ ...formData, assetType: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-navy-900 bg-white"
                  >
                    <option value="WEBSITE">Website</option>
                    <option value="SERVER">Server</option>
                    <option value="APPLICATION">Application</option>
                    <option value="DATABASE">Database</option>
                    <option value="DIGITAL_CERTIFICATE">Digital Certificate</option>
                    <option value="STORAGE_BACKUP">Storage & Backup</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Data Sensitivity *</label>
                  <select
                    value={formData.dataSensitivity}
                    onChange={(e) => setFormData({ ...formData, dataSensitivity: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-navy-900 bg-white"
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="INTERNAL">Internal</option>
                    <option value="CONFIDENTIAL">Confidential</option>
                    <option value="HIGHLY_SENSITIVE">Highly Sensitive</option>
                    <option value="REGULATED">Regulated (FERPA/HIPAA)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">TLS Version</label>
                  <input
                    type="text"
                    placeholder="TLSv1.3"
                    value={formData.tlsVersion}
                    onChange={(e) => setFormData({ ...formData, tlsVersion: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Port</label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value, 10) || 443 })}
                    className="w-full px-3 py-2 rounded border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Environment</label>
                  <select
                    value={formData.environment}
                    onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-slate-200 bg-white"
                  >
                    <option value="PRODUCTION">Production</option>
                    <option value="STAGING">Staging</option>
                    <option value="DEVELOPMENT">Development</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Reported / Known Cryptographic Algorithms
                </label>
                <input
                  type="text"
                  placeholder="e.g. RSA-2048, ECDHE-P256, AES-256-GCM"
                  value={formData.knownAlgorithms}
                  onChange={(e) => setFormData({ ...formData, knownAlgorithms: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Operational Notes</label>
                <textarea
                  rows={3}
                  placeholder="Context, dependencies, responsible team..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingAsset(null);
                  }}
                  className="px-3 py-2 rounded text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-navy-900 hover:bg-navy-850 text-white font-medium rounded shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingAsset ? 'Save Changes' : 'Register Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 border border-slate-200">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-semibold text-slate-900 text-sm">Confirm Asset Deletion</h3>
            </div>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete this asset? All associated findings, scans, and
              assessment records will also be permanently removed.
            </p>
            <div className="mt-5 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded shadow-sm"
              >
                Delete Asset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Asset Detail Drawer / Modal */}
      {viewAsset && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full p-6 border border-slate-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">{viewAsset.name}</h3>
                <p className="font-mono text-xs text-slate-500 mt-0.5">{viewAsset.identifier}</p>
              </div>
              <button onClick={() => setViewAsset(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px]">Asset Type</span>
                  <span className="font-medium text-slate-800">{viewAsset.assetType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Sensitivity</span>
                  <span className="font-medium text-slate-800">{viewAsset.dataSensitivity}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Environment</span>
                  <span className="font-medium text-slate-800">{viewAsset.environment}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Evidence Source</span>
                  <span className="font-medium text-slate-800">{viewAsset.informationSource}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block font-medium mb-1">Cryptographic Profile</span>
                <div className="p-3 bg-slate-900 text-slate-200 font-mono text-[11px] rounded">
                  {viewAsset.knownAlgorithms || 'No known algorithms logged.'}
                </div>
              </div>

              {viewAsset.notes && (
                <div>
                  <span className="text-slate-500 block font-medium mb-1">Operational Notes</span>
                  <p className="p-3 bg-slate-50 text-slate-700 rounded border border-slate-200">
                    {viewAsset.notes}
                  </p>
                </div>
              )}

              <div className="pt-2 text-slate-400 text-[11px] flex justify-between border-t border-slate-100">
                <span>Created: {formatDate(viewAsset.createdAt)}</span>
                <span>Last Updated: {formatDate(viewAsset.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
