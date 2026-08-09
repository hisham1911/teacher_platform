export interface PlanLimits {
  maxQuizzesPerTenant: number;
  maxQuestionsPerQuiz: number;
  maxPublishedQuizzesPerTenant: number;
  maxAttemptsPerMonth: number;
  maxStorageBytes: number;
  maxCertificatesPerMonth: number;
}

export interface SaasPlan {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  limits: PlanLimits;
  version: number;
}

export interface SaasSubscription {
  id: string;
  tenantId: string;
  planId: string;
  planCode: string;
  planName: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
}

export interface PlatformTenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  subscription: SaasSubscription | null;
}

export interface PlatformUser {
  id: string;
  email: string;
  fullName: string;
  status: string;
  emailConfirmed: boolean;
  lockoutEnd: string | null;
  tenantCount: number;
  platformRoles: string[];
  createdAt: string;
}

export interface UsageMetric {
  metric: string;
  value: number;
  limit: number | null;
}

export interface TenantUsage {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  metrics: UsageMetric[];
}

export interface PlatformAuditLog {
  id: string;
  tenantId: string | null;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadataJson: string;
  requestId: string | null;
  createdAt: string;
}

export interface CreatePlanRequest {
  code: string;
  name: string;
  isActive: boolean;
  limits: PlanLimits;
}

export interface TenantTransferSummary {
  dryRun: boolean;
  sourceTenantId: string;
  targetTenantId: string;
  counts: Record<string, number>;
}
