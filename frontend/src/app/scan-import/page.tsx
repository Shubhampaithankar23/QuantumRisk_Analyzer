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
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowRight,
  Info,
  Clock,
  ExternalLink,
  Trash2,
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

  useEffect(() => {
    loadScanHistory();
  }, []);

  // Handle TLS Scan
  const handleStartScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmAuth) {
      setScanError('You must explicitly confirm authorization before scanning this endpoint.');
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
      setImportError(err.message || 'Failed to commit imported assets to database');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Scan & Import Center"
        subtitle="Live authorized TLS cryptographic scanning and bulk asset inventory ingestion (CSV, XLSX, JSON)."
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('scan')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'scan'
                ? 'border-navy-900 text-navy-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Radio className="w-4 h-4 text-pqgreen-500" />
            Authorized TLS Scanner
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'import'
                ? 'border-navy-900 text-navy-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-pqgreen-500" />
            Bulk Multi-File Import
          </button>
        </div>

        {/* TAB 1: AUTHORIZED TLS SCANNER */}
        {activeTab === 'scan' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Radio className="w-4 h-4 text-pqgreen-600" />
                Live Cryptographic & TLS Configuration Inspection
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Performs deterministic TLS handshake probes against an authorized endpoint to identify
                supported TLS versions, cipher suites, certificate public keys, and observable key exchange groups.
              </p>

              {scanError && (
                <div className="mt-4 p-3.5 rounded bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Scan Target Rejection / Error</p>
                    <p className="mt-0.5">{scanError}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleStartScan} className="mt-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-3">
                    <label className="block font-medium text-slate-700 mb-1">
                      Authorized FQDN Hostname *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. portal.apex.edu or mit.edu"
                      value={scanTarget}
                      onChange={(e) => setScanTarget(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-navy-900 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Port</label>
                    <select
                      value={scanPort}
                      onChange={(e) => setScanPort(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-navy-900 bg-white"
                    >
                      <option value={443}>443 (HTTPS)</option>
                      <option value={8443}>8443 (Alt HTTPS)</option>
                    </select>
                  </div>
                </div>

                {/* Authorization Confirmation Checkbox */}
                <div className="p-3.5 bg-slate-50 rounded border border-slate-200 space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmAuth}
                      onChange={(e) => setConfirmAuth(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-navy-900 focus:ring-navy-900 border-slate-300"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed font-medium">
                      I confirm that I am explicitly authorized by my institution or domain owner to
                      inspect the TLS configuration of this target host.
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-500 pl-6 leading-relaxed">
                    <span className="font-semibold text-slate-700">Security Enforcement:</span> All targets
                    are validated against Server-Side Request Forgery (SSRF) rules. Loopback (127.0.0.1),
                    RFC1918 private IP addresses (10.x, 192.168.x, 172.16-31.x), and cloud metadata endpoints
                    are strictly denied.
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={scanning || !confirmAuth || !scanTarget.trim()}
                    className="px-4 py-2 bg-navy-900 hover:bg-navy-850 text-white font-medium rounded shadow-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    {scanning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-pqgreen-400" />
                        Executing Handshake Probes...
                      </>
                    ) : (
                      <>
                        <Radio className="w-4 h-4 text-pqgreen-400" />
                        Initiate Authorized Scan
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Live Scan Results Display */}
            {scanResult && (
              <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-5 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                  <div>
                    <span className="inline-block px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded mb-1">
                      TLS Handshake Verified ({scanResult.executionTimeMs}ms)
                    </span>
                    <h3 className="text-base font-bold text-slate-900 font-mono">
                      {scanResult.targetHost}:{scanResult.port}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Resolved IP: {scanResult.result.resolvedIp} • Timestamp:{' '}
                      {formatDate(new Date())}
                    </p>
                  </div>

                  {scanResult.linkedAssetId && (
                    <Link
                      href="/assessments"
                      className="px-3.5 py-1.5 bg-pqgreen-600 hover:bg-pqgreen-700 text-white text-xs font-medium rounded flex items-center gap-1.5 shadow-sm transition"
                    >
                      Assess Quantum Risk &rarr;
                    </Link>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div className="p-3.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-400 block text-[11px]">Negotiated TLS Version</span>
                    <span className="font-semibold text-slate-900 text-sm font-mono mt-0.5 block">
                      {scanResult.result.tlsVersionNegotiated || 'None'}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Supported: {scanResult.result.supportedTlsVersions?.join(', ')}
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-400 block text-[11px]">Certificate Public Key</span>
                    <span className="font-semibold text-slate-900 text-sm font-mono mt-0.5 block">
                      {scanResult.result.certPubKeyAlgo} ({scanResult.result.certKeySize} bits)
                    </span>
                    <span className="text-[10px] text-red-600 font-medium mt-1 block">
                      Vulnerable to Shor\'s Algorithm
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-400 block text-[11px]">Key Exchange Mechanism</span>
                    <span className="font-semibold text-slate-900 text-sm font-mono mt-0.5 block">
                      {scanResult.result.keyExchangeGroup}
                    </span>
                    <span className="text-[10px] text-amber-600 font-medium mt-1 block">
                      {scanResult.result.isPqHybrid ? 'Hybrid PQ Group Active' : 'SNDL Exposure Risk'}
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-400 block text-[11px]">Certificate Expiration</span>
                    <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                      {formatDate(scanResult.result.certValidTo)}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1 block truncate">
                      Issuer: {scanResult.result.certIssuer}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-900 text-slate-200 font-mono text-[11px] rounded space-y-1">
                  <p className="text-slate-400 font-semibold mb-1">Negotiated Cipher Suite & Details:</p>
                  <p>Cipher: {scanResult.result.cipherSuiteNegotiated}</p>
                  <p>Signature Algorithm: {scanResult.result.certSignatureAlgo}</p>
                  <p>Subject: {scanResult.result.certSubject}</p>
                </div>
              </div>
            )}

            {/* Previous Scans Table */}
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-100 flex items-center justify-between">
                <span>Recent TLS Inspection Audit Log</span>
                <button
                  onClick={loadScanHistory}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-normal"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </h3>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-3">Target Host</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">TLS Protocol</th>
                      <th className="py-2.5 px-3">Public Key Algo</th>
                      <th className="py-2.5 px-3">Executed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {recentScans.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          No scans logged yet. Initiate an authorized scan above.
                        </td>
                      </tr>
                    ) : (
                      recentScans.map((scan) => {
                        const res = scan.results?.[0];
                        return (
                          <tr key={scan.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                              {scan.targetHost}:{scan.port}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                  scan.status === 'COMPLETED'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-red-50 text-red-700 border-red-200'
                                }`}
                              >
                                {scan.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono">{res?.tlsVersionNegotiated || 'N/A'}</td>
                            <td className="py-2.5 px-3 font-mono">
                              {res?.certPubKeyAlgo ? `${res.certPubKeyAlgo} (${res.certKeySize}b)` : 'N/A'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {formatDate(scan.completedAt || scan.createdAt)}
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
        )}

        {/* TAB 2: BULK MULTI-FILE IMPORT */}
        {activeTab === 'import' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-pqgreen-600" />
                Bulk Asset Inventory Ingestion (CSV, XLSX, JSON)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Upload multiple asset spreadsheets or export records in a single batch. Files will be
                parsed, field-mapped, and checked for duplicates before you confirm database insertion.
              </p>

              {/* Multi-File Upload Zone */}
              <div className="mt-5 border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-navy-900/40 transition bg-slate-50/50">
                <input
                  type="file"
                  id="multi-file-input"
                  multiple
                  accept=".csv,.xlsx,.xls,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="multi-file-input" className="cursor-pointer block">
                  <UploadCloud className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                  <span className="text-xs font-semibold text-navy-900">
                    Click to select files or drag and drop
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Supports .CSV, .XLSX, and .JSON files (up to 20MB per file)
                  </p>
                </label>
              </div>

              {/* Selected Files Queue */}
              {selectedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-700">
                    Selected Files ({selectedFiles.length})
                  </h4>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-md overflow-hidden bg-white">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="p-3 flex items-center justify-between text-xs hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-2.5">
                          {file.name.endsWith('.csv') ? (
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          ) : file.name.endsWith('.json') ? (
                            <FileCode className="w-4 h-4 text-amber-600" />
                          ) : (
                            <FileText className="w-4 h-4 text-blue-600" />
                          )}
                          <span className="font-medium text-slate-800">{file.name}</span>
                          <span className="text-[11px] text-slate-400">
                            ({Math.round(file.size / 1024)} KB)
                          </span>
                        </div>
                        <button
                          onClick={() => removeFile(idx)}
                          className="text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleGeneratePreview}
                      disabled={previewLoading}
                      className="px-4 py-2 bg-navy-900 hover:bg-navy-850 text-white text-xs font-medium rounded shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      {previewLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-pqgreen-400" />
                          Parsing and Validating...
                        </>
                      ) : (
                        'Generate Import Preview'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {importError && (
                <div className="mt-4 p-3.5 rounded bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {importSummary && (
                <div className="mt-4 p-4 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Import Successfully Executed
                  </p>
                  <p>
                    {importSummary.imported} assets imported into institutional inventory.
                    {importSummary.duplicates > 0 && ` (${importSummary.duplicates} duplicate(s) handled).`}
                  </p>
                  <Link
                    href="/assets"
                    className="inline-block mt-2 font-semibold text-emerald-900 underline"
                  >
                    View in Asset Inventory &rarr;
                  </Link>
                </div>
              )}
            </div>

            {/* PREVIEW TABLE AND USER CONFIRMATION */}
            {previewData && (
              <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Import Preview & Validation Check
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Review parsed records below. Verify column mappings before committing changes to the database.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={skipDuplicates}
                        onChange={(e) => setSkipDuplicates(e.target.checked)}
                        className="rounded text-navy-900 focus:ring-navy-900 border-slate-300"
                      />
                      <span>Skip existing duplicates</span>
                    </label>

                    <button
                      onClick={handleExecuteImport}
                      disabled={importing || previewData.validRecords === 0}
                      className="px-4 py-2 bg-pqgreen-600 hover:bg-pqgreen-700 text-white text-xs font-semibold rounded shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {importing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Inserting...
                        </>
                      ) : (
                        `Confirm & Import (${previewData.validRecords} Records)`
                      )}
                    </button>
                  </div>
                </div>

                {/* Validation summary badges */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2.5 py-1 bg-slate-100 rounded text-slate-700 font-medium">
                    Total Parsed: {previewData.totalRecords}
                  </span>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-medium">
                    Valid for Import: {previewData.validRecords}
                  </span>
                  {previewData.duplicateRecords > 0 && (
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded font-medium">
                      Duplicates Detected: {previewData.duplicateRecords}
                    </span>
                  )}
                  {previewData.invalidRecords > 0 && (
                    <span className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded font-medium">
                      Validation Errors: {previewData.invalidRecords}
                    </span>
                  )}
                </div>

                {/* Preview Table */}
                <div className="overflow-x-auto max-h-96 border border-slate-200 rounded-md">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Asset Name</th>
                        <th className="py-2.5 px-3">Hostname / Identifier</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Sensitivity</th>
                        <th className="py-2.5 px-3">Reported Algorithms</th>
                        <th className="py-2.5 px-3">Source File</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {previewData.items.map((item: any, idx: number) => (
                        <tr
                          key={idx}
                          className={
                            item.isDuplicate
                              ? 'bg-amber-50/40'
                              : !item.isValid
                              ? 'bg-red-50/40'
                              : 'hover:bg-slate-50'
                          }
                        >
                          <td className="py-2.5 px-3">
                            {item.isDuplicate ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                                Duplicate
                              </span>
                            ) : item.isValid ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                Ready
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800">
                                Invalid
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">{item.name}</td>
                          <td className="py-2.5 px-3 font-mono">{item.identifier}</td>
                          <td className="py-2.5 px-3">{item.assetType}</td>
                          <td className="py-2.5 px-3">{item.dataSensitivity}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] max-w-xs truncate">
                            {item.knownAlgorithms || 'N/A'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                            {item.sourceFile} (Row {item.rowNumber})
                          </td>
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
    </div>
  );
}
