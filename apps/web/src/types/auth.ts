/** نموذج العقود التي يعيدها POST /api/v1/auth/login و /api/v1/auth/refresh */

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  emailConfirmed: boolean;
  platformRoles: string[];
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
  status: string;
}

export interface SessionResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: AuthUser;
  activeWorkspace: Workspace | null;
}

export interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  timezone: string;
  defaultLocale: string;
  status: string;
  myRole: string;
  settings: TenantSettings;
}

export interface TenantSettings {
  logoObjectKey: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  publicTeacherName: string | null;
  certificateSignatureObjectKey: string | null;
  settingsJson: string;
}

export interface MessageResponse {
  message: string;
}
