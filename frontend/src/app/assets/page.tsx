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
  const [assetHistory, setAssetHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form state with explicit cryptographic dropdowns supporting 'Unknown'
  const [formData, setFormData] = useState({
    name: '',
    identifier: '',
    assetType: 'WEBSITE',
    dataSensitivity: 'CONFIDENTIAL',
    knownAlgorithms: '',
    tlsVersion: 'TLSv1.3',
    port: 443,
    environment: 'PRODUCTION',
    certPubKeyAlgo: 'Unknown',
    certKeySize: 'Unknown',
    keyExchangeGroup: 'Unknown',
    cipherSuite: 'Unknown',
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
      certPubKeyAlgo: 'Unknown',
      certKeySize: 'Unknown',
      keyExchangeGroup: 'Unknown',
      cipherSuite: 'Unknown',
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
      certPubKeyAlgo: 'Unknown',
      certKeySize: 'Unknown',
      keyExchangeGroup: 'Unknown',
      cipherSuite: 'Unknown',
      notes: asset.notes || '',
    });
    setFormError(null);
    setShowAddModal(true);
  };

  const handleViewAsset = async (asset: AssetRecord) => {
    setViewAsset(asset);
    setAssetHistory([]);
    setLoadingHistory(true);
    try {
      const res = await fetchApi<any>(`/assets/${asset.id}/history`);
      if (res.success) {
        setAssetHistory(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load asset history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      // Build known algorithms inventory array from form inputs if specified
      const algos: Array<{ algorithm: string; purpose: string }> = [];
      if (formData.certPubKeyAlgo !== 'Unknown') {
        const keySize = formData.certKeySize !== 'Unknown' ? `-${formData.certKeySize}` : '';
        algos.push({
          algorithm: `${formData.certPubKeyAlgo}${keySize}`,
          purpose: 'DIGITAL_SIGNATURE',
        });
      }
      if (formData.keyExchangeGroup !== 'Unknown') {
        algos.push({
          algorithm: formData.keyExchangeGroup,
          purpose: 'KEY_ESTABLISHMENT',
        });
      }
      if (formData.cipherSuite !== 'Unknown') {
        algos.push({
          algorithm: formData.cipherSuite,
          purpose: 'SYMMETRIC_ENCRYPTION',
        });
      }
      if (formData.knownAlgorithms && formData.knownAlgorithms.trim() !== '') {
        const extra = formData.knownAlgorithms.split(',').map((s) => s.trim()).filter(Boolean);
        for (const item of extra) {
          algos.push({ algorithm: item, purpose: 'UNKNOWN' });
        }
      }

      const payload = {
        name: formData.name,
        identifier: formData.identifier || undefined,
        assetType: formData.assetType,
        dataSensitivity: formData.dataSensitivity,
        tlsVersion: formData.tlsVersion !== 'Unknown' ? formData.tlsVersion : undefined,
        port: formData.port,
        environment: formData.environment,
        knownAlgorithms: algos.length > 0 ? JSON.stringify(algos) : (formData.knownAlgorithms || undefined),
        informationSource: 'MANUAL',
        notes: formData.notes,
      };

      if (editingAsset) {
        await fetchApi(`/assets/${editingAsset.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await fetchApi('/assets', {
          method: 'POST',
          body: JSON.stringify(payload),
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
                              onClick={() => handleViewAsset(asset)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100"
                              title="View Asset Details & Edit History"
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
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full p-6 border border-slate-200 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">
                  {editingAsset ? 'Edit Institutional Asset' : 'Register New Institutional Asset'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Manual inventory entry — stored as <span className="font-semibold text-slate-700">user_reported (unverified)</span>.
                </p>
              </div>
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

            {/* Provenance Banner */}
            <div className="mt-3 p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <strong>Manual Entry Policy:</strong> Cryptographic configuration entered here is tagged as <em>user_reported</em> and will not be claimed as independently scanner-verified. Only asset name and type are required.
              </div>
            </div>

            {formError && (
              <div className="mt-3 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              {/* Section 1: Core Asset Info */}
              <div className="space-y-3 pb-3 border-b border-slate-100">
                <span className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider block">
                  1. Core Asset Details
                </span>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Asset Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Student Identity Gateway"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-navy-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      System Identifier / Hostname (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. idp.university.edu (auto-generated if empty)"
                      value={formData.identifier}
                      onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                      className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-navy-900 font-mono text-[11px]"
                    />
                  </div>

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
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Data Sensitivity</label>
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
              </div>

              {/* Section 2: TLS & Certificate Configuration */}
              <div className="space-y-3 pb-3 border-b border-slate-100">
                <span className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider block">
                  2. TLS & Certificate Configuration (Optional)
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">TLS Protocol Version</label>
                    <select
                      value={formData.tlsVersion}
                      onChange={(e) => setFormData({ ...formData, tlsVersion: e.target.value })}
                      className="w-full px-3 py-2 rounded border border-slate-200 bg-white font-mono text-[11px]"
                    >
                      <option value="Unknown">Unknown / Not Observed</option>
                      <option value="TLSv1.3">TLSv1.3 (Modern)</option>
                      <option value="TLSv1.2">TLSv1.2 (Legacy)</option>
                      <option value="TLSv1.1">TLSv1.1 (Deprecated)</option>
                      <option value="TLSv1.0">TLSv1.0 (Deprecated)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Port</label>
                    <input
                      type="number"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value, 10) || 443 })}
                      className="w-full px-3 py-2 rounded border border-slate-200 font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Certificate Public Key Algorithm</label>
                    <select
                      value={formData.certPubKeyAlgo}
                      onChange={(e) => setFormData({ ...formData, certPubKeyAlgo: e.target.value })}
                      className="w-full px-3 py-2 rounded border border-slate-200 bg-white font-mono text-[11px]"
                    >
                      <option value="Unknown">Unknown / Not Observed</option>
                      <option value="RSA">RSA (Classical Vulnerable)</option>
                      <option value="ECDSA">ECDSA (Classical Vulnerable)</option>
                      <option value="Ed25519">Ed25519 (Classical Edwards Curve)</option>
                      <option value="ML-DSA-65">ML-DSA-65 (NIST FIPS 204 Post-Quantum)</option>
                      <option value="SLH-DSA">SLH-DSA (NIST FIPS 205 Stateless Hash)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Certificate Key Size</label>
                    <select
                      value={formData.certKeySize}
                      onChange={(e) => setFormData({ ...formData, certKeySize: e.target.value })}
                      className="w-full px-3 py-2 rounded border border-slate-200 bg-white font-mono text-[11px]"
                    >
                      <option value="Unknown">Unknown / Not Observed</option>
                      <option value="2048">2048 bits (RSA / DH)</option>
                      <option value="3072">3072 bits (RSA / DH)</option>
                      <option value="4096">4096 bits (RSA / DH)</option>
                      <option value="256">256 bits (P-256 / secp256r1)</option>
                      <option value="384">384 bits (P-384 / secp384r1)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Key Exchange & Symmetric Inventory */}
              <div className="space-y-3 pb-3 border-b border-slate-100">
                <span className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider block">
                  3. Key Exchange & Symmetric Cipher (Optional)
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Key Exchange Mechanism</label>
                    <select
                      value={formData.keyExchangeGroup}
                      onChange={(e) => setFormData({ ...formData, keyExchangeGroup: e.target.value })}
                      className="w-full px-3 py-2 rounded border border-slate-200 bg-white font-mono text-[11px]"
                    >
                      <option value="Unknown">Unknown / Not Observed</option>
                      <option value="X25519MLKEM768">X25519MLKEM768 (Hybrid Post-Quantum FIPS 203)</option>
                      <option value="ML-KEM-768">ML-KEM-768 (Pure Post-Quantum FIPS 203)</option>
                      <option value="ECDHE-X25519">ECDHE-X25519 (Classical Elliptic Curve)</option>
                      <option value="ECDHE-P256">ECDHE-P256 (Classical NIST Curve)</option>
                      <option value="Static RSA Key Transport">Static RSA Key Transport (Deprecated, No PFS)</option>
                      <option value="DHE">DHE (Classical Finite Field DH)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Symmetric Cipher Suite</label>
                    <select
                      value={formData.cipherSuite}
                      onChange={(e) => setFormData({ ...formData, cipherSuite: e.target.value })}
                      className="w-full px-3 py-2 rounded border border-slate-200 bg-white font-mono text-[11px]"
                    >
                      <option value="Unknown">Unknown / Not Observed</option>
                      <option value="AES-256-GCM">AES-256-GCM (Quantum Resistant, 128-bit Grover)</option>
                      <option value="CHACHA20-POLY1305">ChaCha20-Poly1305 (Quantum Resistant)</option>
                      <option value="AES-128-GCM">AES-128-GCM (Reduced 64-bit Grover Margin)</option>
                      <option value="3DES-EDE-CBC">3DES-EDE-CBC (Broken)</option>
                      <option value="RC4-128">RC4-128 (Broken)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Additional Cryptographic Primitives (Comma separated or notes)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SHA-384, AES-256-CBC, Ed25519"
                    value={formData.knownAlgorithms}
                    onChange={(e) => setFormData({ ...formData, knownAlgorithms: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-slate-200 font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* Section 4: Operational Notes */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">Operational Notes</label>
                <textarea
                  rows={2}
                  placeholder="System owner, research project context, dependencies..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-200 text-xs"
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
                  {submitting ? 'Saving...' : editingAsset ? 'Save Changes' : 'Register Asset (Manual)'}
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

      {/* View Asset Detail Drawer / Modal with Edit History */}
      {viewAsset && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 border border-slate-200 max-h-[85vh] overflow-y-auto">
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
                  <span className="text-slate-400 block text-[11px]">Evidence Provenance</span>
                  <span className="font-medium text-slate-800">
                    {viewAsset.informationSource === 'MANUAL' ? (
                      <span className="text-amber-700 font-semibold">Manual Entry (Unverified)</span>
                    ) : viewAsset.informationSource.startsWith('IMPORT') ? (
                      <span className="text-blue-700 font-semibold">Imported Inventory (Unverified)</span>
                    ) : (
                      <span className="text-emerald-700 font-semibold">Verified TLS Scan</span>
                    )}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block font-medium mb-1">Cryptographic Profile</span>
                <div className="p-3 bg-slate-900 text-slate-200 font-mono text-[11px] rounded break-all whitespace-pre-wrap">
                  {viewAsset.knownAlgorithms || 'No cryptographic primitives recorded.'}
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

              {/* Edit History & Audit Trail */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
                    Change History & Audit Trail
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    {assetHistory.length} audit event(s) recorded
                  </span>
                </div>

                {loadingHistory ? (
                  <div className="p-3 text-center text-slate-400 text-xs">Loading audit history...</div>
                ) : assetHistory.length === 0 ? (
                  <div className="p-3 rounded bg-slate-50 border border-slate-200 text-slate-500 text-xs">
                    No change history logged for this asset yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {assetHistory.map((entry) => {
                      let detailsObj: any = null;
                      try {
                        detailsObj = entry.details ? JSON.parse(entry.details) : null;
                      } catch {
                        detailsObj = entry.details;
                      }

                      return (
                        <div
                          key={entry.id}
                          className="p-2.5 rounded bg-slate-50 border border-slate-200 text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="font-semibold text-slate-800">
                              {entry.action.replace(/_/g, ' ')}
                            </span>
                            <span className="text-slate-400 font-mono text-[10px]">
                              {formatDate(entry.timestamp)}
                            </span>
                          </div>
                          {entry.user && (
                            <div className="text-slate-500 text-[10px]">
                              Actor: <span className="font-medium text-slate-700">{entry.user.name || entry.user.email}</span> ({entry.user.role})
                            </div>
                          )}
                          {detailsObj?.changedFields && (
                            <div className="mt-1 font-mono text-[10px] text-slate-600 bg-white p-1.5 rounded border border-slate-200">
                              {Object.entries(detailsObj.changedFields).map(([field, delta]: [string, any]) => (
                                <div key={field}>
                                  <span className="font-semibold text-slate-700">{field}:</span>{' '}
                                  <span className="text-red-500">{String(delta.before ?? 'none')}</span> &rarr;{' '}
                                  <span className="text-emerald-600">{String(delta.after ?? 'none')}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

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
