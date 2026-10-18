export const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export class ApiError extends Error {
  status: number;
  statusText: string;
  code?: string;
  details?: any;
  data?: any;
  body?: string;

  constructor(status: number, statusText: string, message: string, code?: string, details?: any, data?: any, body?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.code = code;
    this.details = details;
    this.data = data;
    this.body = body;
  }
}

export function buildApiUrl(endpoint: string): string {
  if (endpoint.startsWith('http')) return endpoint;

  const base = (API_BASE || '/api/v1').replace(/\/+$/, '');
  let path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // If base already ends with /api/v1 and path starts with /api/v1, de-duplicate
  if (base.endsWith('/api/v1') && path.startsWith('/api/v1')) {
    path = path.substring('/api/v1'.length);
    if (!path.startsWith('/')) path = `/${path}`;
  }

  // If base is an absolute HTTP/HTTPS URL (e.g. production cloud URL)
  if (base.startsWith('http')) {
    return `${base}${path}`;
  }

  // If running in browser, relative URL works seamlessly across laptop, localhost, and mobile device
  if (typeof window !== 'undefined') {
    return `${base}${path}`;
  }

  // If running server-side without window, resolve to internal backend URL
  const serverTarget =
    process.env.BACKEND_INTERNAL_URL ||
    process.env.BACKEND_URL ||
    'http://127.0.0.1:4000/api/v1';
  return `${serverTarget.replace(/\/+$/, '')}${path}`;
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('pq_auth_token');
}

export function setAuthToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('pq_auth_token', token);
  document.cookie = `pq_auth_token=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;
}

export function getCurrentUser(): any | null {
  if (typeof window === 'undefined') return null;
  const userJson = localStorage.getItem('pq_auth_user');
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

export function setCurrentUser(user: any) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('pq_auth_user', JSON.stringify(user));
}

export function logout() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('pq_auth_token');
  localStorage.removeItem('pq_auth_user');
  document.cookie = 'pq_auth_token=; path=/; max-age=0; SameSite=Lax';
}

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = buildApiUrl(endpoint);
  const token = getAuthToken();

  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string>),
  };

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      cache: 'no-store',
    });
  } catch (networkErr: any) {
    const rawMsg = networkErr?.message || 'Network connection failed';
    const isFailedToFetch =
      rawMsg.toLowerCase().includes('failed to fetch') ||
      rawMsg.toLowerCase().includes('network') ||
      rawMsg.toLowerCase().includes('load failed');

    const enrichedMsg = isFailedToFetch
      ? `Network Connection Failure: Unable to reach backend at "${url}". Please ensure the backend server is running and accessible.`
      : `Network Error: ${rawMsg} (URL: ${url})`;

    throw new Error(enrichedMsg);
  }

  let responseBodyText = '';
  let data: any = {};
  try {
    responseBodyText = await response.text();
    data = JSON.parse(responseBodyText);
  } catch {
    data = responseBodyText ? { message: responseBodyText } : {};
  }

  if (!response.ok) {
    if (response.status === 401) {
      logout();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    const statusText = response.statusText ? ` ${response.statusText}` : '';
    const mainMsg =
      data?.message ||
      data?.error?.message ||
      data?.error ||
      (typeof data === 'string' && data ? data : response.statusText || 'Server Error');

    const codeTag = data?.code ? ` [${data.code}]` : '';

    let detailsStr = '';
    if (data?.details) {
      if (Array.isArray(data.details)) {
        detailsStr =
          ' - ' +
          data.details
            .map((d: any) =>
              typeof d === 'object'
                ? `${d.field ? `${d.field}: ` : ''}${d.message || JSON.stringify(d)}`
                : String(d)
            )
            .join('; ');
      } else if (typeof data.details === 'object') {
        detailsStr = ' - ' + JSON.stringify(data.details);
      } else {
        detailsStr = ` - ${data.details}`;
      }
    }

    const fullMessage = `HTTP ${response.status}${statusText}${codeTag}: ${mainMsg}${detailsStr}`;
    throw new ApiError(
      response.status,
      response.statusText,
      fullMessage,
      data?.code,
      data?.details,
      data,
      responseBodyText
    );
  }

  return data;
}

export interface DashboardStats {
  totalAssets: number;
  assessedAssets: number;
  highRiskAssets: number;
  pendingAssessments: number;
  assessmentProgress: number;
  riskDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  sourceDistribution: {
    liveScanned: number;
    manual: number;
    imported: number;
  };
  evidenceStats: {
    scannerVerified: number;
    userReported: number;
    imported: number;
    inferred: number;
  };
  remediationStats: {
    open: number;
    inProgress: number;
    resolved: number;
    acceptedRisk: number;
    total: number;
    progressPct: number;
  };
  scanStats: {
    total: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
  };
  missingInfo: {
    count: number;
    assets: Array<{
      id: string;
      name: string;
      identifier: string;
      assetType: string;
      informationSource: string;
      assessmentStatus: string;
      tlsVersion?: string | null;
    }>;
  };
  inconclusiveCount: number;
  recentScans: Array<{
    id: string;
    targetHost: string;
    port: number;
    status: string;
    tlsVersionNegotiated?: string;
    certPubKeyAlgo?: string;
    certKeySize?: number;
    checksCount?: number;
    evidenceCount?: number;
    completedAt?: string;
    createdAt: string;
  }>;
  urgentRecommendations: Array<{
    id: string;
    recommendedAlgorithm: string;
    rationale: string;
    urgency: string;
    finding: {
      title: string;
      algorithmOrConfig: string;
      purpose: string;
      riskLevel: string;
      riskReason: string;
      asset: {
        name: string;
        identifier: string;
        assetType: string;
      };
    };
  }>;
}
