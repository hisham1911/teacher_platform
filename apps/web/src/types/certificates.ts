export type CertificateStatus = 'Pending' | 'Ready' | 'Failed';

export interface CertificateTemplate {
  id: string;
  name: string;
  titleText: string;
  bodyText: string;
  issuerName: string;
  primaryColor: string;
  secondaryColor: string;
  isDefault: boolean;
  version: number;
  updatedAt: string;
}

export interface SaveCertificateTemplateRequest {
  name: string;
  titleText: string;
  bodyText: string;
  issuerName: string;
  primaryColor: string;
  secondaryColor: string;
  isDefault: boolean;
  baseVersion: number | null;
}

export interface CertificateListItem {
  id: string;
  attemptId: string;
  certificateNumber: string;
  studentName: string;
  quizTitle: string;
  percentage: number;
  status: CertificateStatus;
  issuedAt: string;
  failureReason: string | null;
  publicUrl: string | null;
}

export interface PlayerCertificate {
  certificateId: string;
  certificateNumber: string;
  status: CertificateStatus;
  issuedAt: string;
  downloadUrl: string | null;
  publicUrl: string | null;
}

export interface ParentShare {
  shareUrl: string;
  expiresAt: string;
}

export interface PublicResult {
  studentName: string;
  quizTitle: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  finishedAt: string;
  reviewAreas: string[];
  certificateUrl: string | null;
}
