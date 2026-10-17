'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import {
  Radio,
  UploadCloud,
  FileSpreadsheet,
  FileText,
  FileCode,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Info,
  Trash2,
  Download,
  Eye,
  X,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { fetchApi } from '@/lib/api';

export default function ScanAndImportPage() {
  const [activeTab, setActiveTab] = useState<'scan' | 'import'>('scan');

  // Scanner state
  const [scanTarget, setScanTarget] = useState('');
  const [scanPort, setScanPort] = useState(443);
  const [confirmAuth, setConfirmAuth] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [deletingScanId, setDeletingScanId] = useState<string | null>(null);
  const [scanDetails, setScanDetails] = useState<any | null>(null);
  const [loadingScanId, setLoadingScanId] = useState<string | null>(null);
  const [scanDetailsError, setScanDetailsError] = useState<string | null>(null);

  // Import state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  // Load scan history
  const loadScanHistory = async () => {
    try {
      const res = await fetchApi<{ success: boolean; data: any[] }>('/scans');
      if (res.success) {
        setRecentScans(res.data);
      }
    } catch (err) {
      console.error('Error loading scan history:', err);
    }
  };

  const handleDeleteScan = async (id: string, host: string) => {
    if (!confirm(`Are you sure you want to cut/delete scan record for "${host}"?`)) return;
    setDeletingScanId(id);
    try {
      const res = await fetchApi<any>(`/scans/${id}`, { method: 'DELETE' });
      if (res.success) {
        if (scanDetails?.id === id) setScanDetails(null);
        await loadScanHistory();
      }
    } catch (err: any) {
      alert(`Failed to delete scan: ${err.message || 'Error occurred'}`);
    } finally {
      setDeletingScanId(null);
    }
  };

  const handleClearAllScans = async () => {
    if (!confirm('Are you sure you want to cut/clear all previous scan records?')) return;
    try {
      const res = await fetchApi<any>('/scans', { method: 'DELETE' });
      if (res.success) {
        setScanDetails(null);
        await loadScanHistory();
      }
    } catch (err: any) {
      alert(`Failed to clear scans: ${err.message || 'Error occurred'}`);
    }
  };

  const handleViewScan = async (id: string) => {
    setLoadingScanId(id);
    setScanDetailsError(null);
    setScanDetails(null);
    try {
      const res = await fetchApi<any>(`/scans/${id}`);
      if (res.success) {
        setScanDetails(res.data);
      }
    } catch (err: any) {
      setScanDetailsError(err.message || 'Failed to load scan results');
    } finally {
      setLoadingScanId(null);
    }
  };

  useEffect(() => {
    loadScanHistory();
  }, []);

  // Handle TLS Scan
  const handleStartScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmAuth) {
      setScanError('Please check the confirmation box to confirm you have permission to test this website.');
      return;
    }

    setScanning(true);
    setScanError(null);
    setScanResult(null);

    try {
      const res = await fetchApi<any>('/scans', {
        method: 'POST',
        body: JSON.stringify({
          targetHost: scanTarget.trim(),
          port: scanPort,
          confirmAuthorized: confirmAuth,
        }),
      });

      if (res.success) {
        setScanResult(res.data);
        loadScanHistory();
      }
    } catch (err: any) {
      setScanError(err.message || 'Scan failed to execute');
    } finally {
      setScanning(false);
    }
  };

  // Handle file drop / select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
      setPreviewData(null);
      setImportSummary(null);
      setImportError(null);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewData(null);
    setImportSummary(null);
  };

  // Preview uploaded files
  const handleGeneratePreview = async () => {
    if (selectedFiles.length === 0) return;
    setPreviewLoading(true);
    setImportError(null);
    setPreviewData(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch('http://localhost:4000/api/v1/imports/preview', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate import preview');
      }

      setPreviewData(data.data);
    } catch (err: any) {
      setImportError(err.message || 'Failed to parse inventory files');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Execute import
  const handleExecuteImport = async () => {
    if (!previewData || !previewData.items) return;
    setImporting(true);
    setImportError(null);

    try {
      const validItems = previewData.items.filter((item: any) => item.isValid);
      const res = await fetchApi<any>('/imports/execute', {
        method: 'POST',
        body: JSON.stringify({
          items: validItems,
          skipDuplicates,
        }),
      });

      if (res.success) {
        setImportSummary(res.data);
        setSelectedFiles([]);
        setPreviewData(null);
      }
    } catch (err: any) {
      setImportError(err.message || 'Failed to import assets');
    } finally {
      setImporting(false);
    }
  };

  // Sample CSV generator
  const downloadSampleCsv = () => {
    const csvContent =
      'name,identifier,assetType,dataSensitivity,knownAlgorithms,tlsVersion,port,notes\n' +
      'Main Campus Portal,portal.campus.edu,WEBSITE,CONFIDENTIAL,"RSA-2048, ECDHE-P256, AES-128-GCM",TLSv1.3,443,Primary student portal\n' +
      'Library Digital Repository,library.campus.edu,WEBSITE,PUBLIC,"RSA-2048, AES-256-GCM",TLSv1.3,443,Open access research papers\n' +
      'Research Compute Node,hpc.campus.edu,SERVER,HIGHLY_SENSITIVE,"ECDSA-P384, X25519, AES-256-GCM",TLSv1.3,443,Biomedical data processing\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample-assets-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        title="Scan & Import Center"
        subtitle="Quickly check any website's quantum safety or import an existing list of systems."
      />

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Simple 2-Tab Selector */}
        <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm flex gap-2">
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
              activeTab === 'scan'
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Radio className="w-4 h-4 text-emerald-400" />
            Option 1: Check a Website Live
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
              activeTab === 'import'
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-blue-400" />
            Option 2: Import Systems File (CSV / Excel)
          </button>
        </div>

        {/* TAB 1: WEBSITE SCANNER */}
        {activeTab === 'scan' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Check Any Website</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  We will test the website's HTTPS connection to see what encryption it uses and if quantum computers could break it.
                </p>
              </div>

              {scanError && (
                <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{scanError}</span>
                </div>
              )}

              <form onSubmit={handleStartScan} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-3">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Website Address (Domain Name)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. portal.apex.edu or harvard.edu"
                      value={scanTarget}
                      onChange={(e) => setScanTarget(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Port</label>
                    <input
                      type="number"
                      value={scanPort}
                      onChange={(e) => setScanPort(parseInt(e.target.value, 10) || 443)}
                      className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmAuth}
                      onChange={(e) => setConfirmAuth(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <span className="text-xs text-slate-800 font-medium leading-relaxed">
                      I confirm that I am authorized by my institution to test this website.
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={scanning || !confirmAuth || !scanTarget.trim()}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 transition"
                >
                  {scanning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Testing Encryption...
                    </>
                  ) : (
                    <>
                      <Radio className="w-4 h-4" />
                      Start Security Scan
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Scan Results Card */}
            {scanResult && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Scan Complete ({scanResult.executionTimeMs} ms)
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-1 font-mono">
                      {scanResult.targetHost}
                    </h3>
                  </div>

                  <Link
                    href="/assessments"
                    className="px-4 py-2 bg-navy-900 hover:bg-navy-850 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition"
                  >
                    View Risk Assessment &rarr;
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Certificate Algorithm</span>
                    <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                      {scanResult.result.certPubKeyAlgo} ({scanResult.result.certKeySize} bits)
                    </span>
                    <span className="text-[11px] text-red-600 font-semibold block mt-1">
                      ⚠️ Quantum-Vulnerable (Needs ML-DSA)
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Key Exchange</span>
                    <span className="font-bold text-slate-900 text-sm mt-0.5 block truncate">
                      {scanResult.result.keyExchangeGroup}
                    </span>
                    <span className="text-[11px] text-orange-600 font-semibold block mt-1">
                      ⚠️ Classical Exchange (Needs ML-KEM)
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">TLS Version</span>
                    <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                      {scanResult.result.tlsVersionNegotiated || 'TLS 1.2/1.3'}
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-1">
                      Cipher: {scanResult.result.cipherSuiteNegotiated}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Scans Table */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Previous Scans</h3>
                  <p className="text-[11px] text-slate-500">History of website TLS checks</p>
                </div>
                {recentScans.length > 0 && (
                  <button
                    onClick={handleClearAllScans}
                    className="text-[11px] font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded border border-red-200 transition flex items-center gap-1"
                    title="Cut / Clear all previous scan records"
                  >
                    <Trash2 className="w-3 h-3" />
                    Cut All History
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {recentScans.length === 0 ? (
                  <p className="text-slate-400 py-4 text-center">No previous scans found.</p>
                ) : (
                  recentScans.slice(0, 10).map((scan) => (
                    <div
                      key={scan.id}
                      className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded -mx-2 transition"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-mono">{scan.targetHost}</span>
                        <span className="text-slate-400 text-[11px]">
                          {formatDate(scan.completedAt || scan.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {scan.status}
                        </span>
                        <button
                          onClick={() => handleViewScan(scan.id)}
                          disabled={loadingScanId === scan.id}
                          className="px-2 py-1 rounded text-xs text-slate-500 hover:text-navy-900 hover:bg-slate-100 border border-transparent transition flex items-center gap-1 disabled:opacity-50"
                          title="View saved scan results"
                        >
                          {loadingScanId === scan.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                          <span className="text-[11px] font-medium">View results</span>
                        </button>
                        <button
                          onClick={() => handleDeleteScan(scan.id, scan.targetHost)}
                          disabled={deletingScanId === scan.id}
                          className="px-2 py-1 rounded text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition flex items-center gap-1"
                          title="Cut / Delete this scan"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-600" />
                          <span className="text-[11px] font-medium text-slate-600 hover:text-red-600">Cut</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BULK FILE IMPORT */}
        {activeTab === 'import' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Import Systems Inventory</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Upload your spreadsheet or CSV file. We will preview the systems before saving.
                  </p>
                </div>

                <button
                  onClick={downloadSampleCsv}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition self-start sm:self-auto"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Sample CSV Template
                </button>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100/80 transition cursor-pointer">
                <input
                  type="file"
                  id="simple-file-input"
                  multiple
                  accept=".csv,.xlsx,.xls,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="simple-file-input" className="cursor-pointer block">
                  <UploadCloud className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                  <span className="text-sm font-bold text-slate-900 block">
                    Choose a file or drag and drop here
                  </span>
                  <span className="text-xs text-slate-500 mt-1 block">
                    Supports .CSV, Excel (.xlsx), and .JSON files
                  </span>
                </label>
              </div>

              {/* Selected Files */}
              {selectedFiles.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-bold text-slate-700 block">
                    Ready to parse ({selectedFiles.length} file):
                  </span>
                  {selectedFiles.map((f, i) => (
                    <div
                      key={i}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-slate-800">{f.name}</span>
                      <button
                        onClick={() => removeFile(i)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={handleGeneratePreview}
                    disabled={previewLoading}
                    className="px-5 py-2.5 bg-navy-900 hover:bg-navy-850 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50 transition"
                  >
                    {previewLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                        Analyzing File...
                      </>
                    ) : (
                      'Preview Systems'
                    )}
                  </button>
                </div>
              )}

              {importError && (
                <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                  {importError}
                </div>
              )}

              {importSummary && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-1">
                  <p className="font-bold text-sm flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Import Complete!
                  </p>
                  <p>{importSummary.imported} systems successfully added to your inventory.</p>
                  <Link
                    href="/assets"
                    className="inline-block mt-2 font-bold text-emerald-900 underline"
                  >
                    View Assets &rarr;
                  </Link>
                </div>
              )}
            </div>

            {/* Preview Section */}
            {previewData && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Preview: {previewData.validRecords} systems ready to import
                    </h3>
                    <p className="text-xs text-slate-500">
                      Check the list below. Click "Confirm & Import" to save them.
                    </p>
                  </div>

                  <button
                    onClick={handleExecuteImport}
                    disabled={importing || previewData.validRecords === 0}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm disabled:opacity-50 transition"
                  >
                    {importing ? 'Saving to Database...' : `Confirm & Save (${previewData.validRecords})`}
                  </button>
                </div>

                <div className="overflow-x-auto max-h-80 border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Name</th>
                        <th className="p-2.5">Hostname</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Sensitivity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewData.items.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5">
                            {item.isDuplicate ? (
                              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold">
                                Duplicate
                              </span>
                            ) : item.isValid ? (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">
                                Ready
                              </span>
                            ) : (
                              <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-semibold">
                                Error
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-medium text-slate-900">{item.name}</td>
                          <td className="p-2.5 font-mono text-slate-600">{item.identifier}</td>
                          <td className="p-2.5">{item.assetType}</td>
                          <td className="p-2.5">{item.dataSensitivity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {(scanDetails || scanDetailsError) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="scan-details-title"
            className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 id="scan-details-title" className="text-base font-bold text-slate-900">
                  Saved TLS Scan Results
                </h2>
                {scanDetails && (
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {scanDetails.targetHost}:{scanDetails.port}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setScanDetails(null);
                  setScanDetailsError(null);
                }}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close scan results"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {scanDetailsError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {scanDetailsError}
              </p>
            ) : scanDetails ? (
              <>
                <div className="mb-4 flex items-center gap-2 text-xs">
                  <span className={`rounded border px-2 py-1 font-semibold ${
                    scanDetails.status === 'COMPLETED'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}>
                    {scanDetails.status}
                  </span>
                  {scanDetails.completedAt && (
                    <span className="text-slate-500">{formatDate(scanDetails.completedAt)}</span>
                  )}
                </div>

                {scanDetails.errorMessage && (
                  <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {scanDetails.errorMessage}
                  </p>
                )}

                {scanDetails.results?.[0] ? (
                  <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                    {[
                      ['TLS version', scanDetails.results[0].tlsVersionNegotiated],
                      ['Supported TLS versions', (() => {
                        try {
                          return JSON.parse(scanDetails.results[0].supportedTlsVersions || '[]').join(', ');
                        } catch {
                          return scanDetails.results[0].supportedTlsVersions;
                        }
                      })()],
                      ['Cipher suite', scanDetails.results[0].cipherSuiteNegotiated],
                      ['Certificate algorithm', scanDetails.results[0].certPubKeyAlgo],
                      ['Certificate key size', scanDetails.results[0].certKeySize ? `${scanDetails.results[0].certKeySize} bits` : null],
                      ['Key exchange', scanDetails.results[0].keyExchangeGroup],
                      ['Certificate subject', scanDetails.results[0].certSubject],
                      ['Certificate issuer', scanDetails.results[0].certIssuer],
                      ['Certificate signature', scanDetails.results[0].certSignatureAlgo],
                      ['Scanner', scanDetails.results[0].scannerVersion],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <span className="mb-1 block text-[11px] text-slate-500">{label}</span>
                        <span className="break-words font-semibold text-slate-900">{value || 'Not available'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">No result details were saved for this scan.</p>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
