export interface ApiKey {
  id: string;
  name: string;
  service: string;
  keyType: string;
  status: string;
  environment?: 'development' | 'staging' | 'production' | string;
  lastUsed: string | null;
  createdAt: string;
  permissions: string[];
  rotationDue: string;
  usageCount: number;
  monthlyQuota: number;
  maskedKey: string;
}

export interface OverviewUsage {
  label: string;
  value: number;
  change?: number;
}

export interface EnvironmentStatus {
  environment: string;
  status: 'healthy' | 'warning' | 'critical' | 'offline' | string;
  responseTimeMs?: number;
}

export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'warning' | 'critical' | 'offline' | string;
  lastCheckedAt?: string;
}
