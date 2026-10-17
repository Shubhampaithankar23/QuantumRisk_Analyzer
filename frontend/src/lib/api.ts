const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

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
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      logout();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    throw new Error(data.message || `Request failed with status ${response.status}`);
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
  recentScans: Array<{
    id: string;
    targetHost: string;
    port: number;
    status: string;
    tlsVersionNegotiated?: string;
    certPubKeyAlgo?: string;
    certKeySize?: number;
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
