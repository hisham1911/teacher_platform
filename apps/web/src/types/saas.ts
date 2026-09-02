export interface PlanLimits {
  maxQuizzesPerTenant: number;
  maxQuestionsPerQuiz: number;
  maxPublishedQuizzesPerTenant: number;
  maxAttemptsPerMonth: number;
  maxStorageBytes: number;
  maxCertificatesPerMonth: number;
  maxStudents: number;
  maxMembers: number;
  maxClasses: number;
  maxActiveAssignments: number;
  maxLiveParticipants: number;
}

export interface PlanEntitlements {
  bulkImport: boolean;
  advancedReports: boolean;
  certificates: boolean;
  customBranding: boolean;
  dataExport: boolean;
  customDomain: boolean;
}

export interface CommercialPlanContract {
  contractVersion: number;
  package: string;
  limits: PlanLimits;
  entitlements: PlanEntitlements;
}

export interface CommercialPackageCatalogItem {
  package: string;
  displayName: string;
  isAvailable: boolean;
  limits: PlanLimits;
  entitlements: PlanEntitlements;
}

export interface SaasPlan {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  contractVersion: number;
  package: string;
  limits: PlanLimits;
  entitlements: PlanEntitlements;
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

export interface PlatformTenantUsageSummary {
  members: number;
  students: number;
  classes: number | null;
  activeAssignments: number | null;
}

export interface PlatformTenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  subscription: SaasSubscription | null;
  commercialStatus: string;
  isGrandfathered: boolean;
  plan: SaasPlan | null;
  usage: PlatformTenantUsageSummary;
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
  nearLimit: boolean;
}

export interface TenantUsage {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  metrics: UsageMetric[];
}

export interface CommercialWorkspaceState {
  tenantId: string;
  commercialStatus: string;
  isGrandfathered: boolean;
  subscription: SaasSubscription | null;
  plan: SaasPlan | null;
  limits: PlanLimits;
  entitlements: PlanEntitlements;
  usage: PlatformTenantUsageSummary;
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
  contract?: CommercialPlanContract;
  /** Compatibility path for existing admin forms while they move to the v2 contract. */
  limits?: PlanLimits;
}

export interface UpdatePlanRequest extends CreatePlanRequest {
  baseVersion: number;
}

export interface ActivateSubscriptionRequest {
  planId: string;
  startsAt?: string | null;
  endsAt?: string | null;
  changeReason?: string | null;
}

export interface TenantTransferSummary {
  dryRun: boolean;
  sourceTenantId: string;
  targetTenantId: string;
  counts: Record<string, number>;
}
