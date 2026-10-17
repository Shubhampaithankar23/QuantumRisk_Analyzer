const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
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
