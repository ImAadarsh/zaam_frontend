import axios from 'axios';
import { clearSession, getSession } from '@/lib/auth';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000';

let interceptorsRegistered = false;

function ensureInterceptors() {
  if (interceptorsRegistered) return;
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error?.response?.status;
      if (status === 401) {
        clearSession();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login?reason=expired';
        }
      }
      return Promise.reject(error);
    }
  );
  interceptorsRegistered = true;
}

ensureInterceptors();

export async function login(payload: { email: string; password: string }) {
  const { data } = await axios.post(`${API_BASE}/api/iam/auth/login`, payload);
  return data as {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; firstName?: string; lastName?: string; organizationId: string; roles: string[] };
  };
}

export async function getGoogleAuthUrl() {
  const { data } = await axios.get(`${API_BASE}/api/iam/auth/google/url`);
  return data as { authUrl: string };
}

function authHeaders() {
  const s = getSession();
  return { Authorization: `Bearer ${s?.accessToken ?? ''}` };
}

// USERS
export async function listUsers() {
  const { data } = await axios.get(`${API_BASE}/api/iam/users`, { headers: authHeaders() });
  return data as { data: any[] };
}
export async function getUser(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/iam/users/${id}`, { headers: authHeaders() });
  return data as { data: any };
}
export async function createUser(payload: { organizationId: string; email: string; username?: string; firstName?: string; lastName?: string; password?: string; roleId: string; businessUnitId?: string; locationId?: string; status?: string }) {
  const { data } = await axios.post(`${API_BASE}/api/iam/users`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function updateUser(id: string, payload: Partial<{ email: string; username: string | null; firstName: string | null; lastName: string | null; status: string }>) {
  const { data } = await axios.patch(`${API_BASE}/api/iam/users/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function deleteUser(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/iam/users/${id}`, { headers: authHeaders() });
  return status === 204;
}

// ROLES
export async function listRoles() {
  const { data } = await axios.get(`${API_BASE}/api/iam/roles`, { headers: authHeaders() });
  return data as { data: any[] };
}
export async function createRole(payload: { organizationId: string; name: string; code: string; permissions?: any }) {
  const { data } = await axios.post(`${API_BASE}/api/iam/roles`, payload, { headers: authHeaders() });
  return data as { data: any };
}
export async function updateRole(id: string, payload: { name?: string; code?: string; permissions?: any }) {
  const { data } = await axios.patch(`${API_BASE}/api/iam/roles/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}
export async function assignRole(payload: { userId: string; roleId: string; businessUnitId: string; locationId: string }) {
  try {
    const { data } = await axios.post(`${API_BASE}/api/iam/roles/assign`, payload, { headers: authHeaders() });
    return data as { data: any };
  } catch (error: any) {
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      throw new Error('Cannot connect to server. Please ensure the backend API is running on ' + API_BASE);
    }
    throw error;
  }
}

export async function unassignRole(payload: { userId: string; roleAssignmentId: string }) {
  try {
    const { data } = await axios.post(`${API_BASE}/api/iam/roles/unassign`, payload, { headers: authHeaders() });
    return data as { data: any };
  } catch (error: any) {
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      throw new Error('Cannot connect to server. Please ensure the backend API is running on ' + API_BASE);
    }
    throw error;
  }
}

// API KEYS
export async function listApiKeys() {
  const { data } = await axios.get(`${API_BASE}/api/iam/api-keys`, { headers: authHeaders() });
  return data as { data: any[] };
}

export async function createApiKey(payload: { organizationId: string; name: string; scopes?: string[] }) {
  const { data } = await axios.post(`${API_BASE}/api/iam/api-keys`, payload, { headers: authHeaders() });
  return data as { data: { id: string; name: string; key: string; keyPrefix: string } };
}

export async function deleteApiKey(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/iam/api-keys/${id}`, { headers: authHeaders() });
  return status === 204;
}

// AUDIT LOGS
export async function listAuditLogs(limit = 50) {
  const { data } = await axios.get(`${API_BASE}/api/iam/audit-logs?limit=${limit}`, { headers: authHeaders() });
  return data as { data: any[] };
}

// ORGANIZATIONS
export async function listOrganizations() {
  const { data } = await axios.get(`${API_BASE}/api/iam/organizations`, { headers: authHeaders() });
  return data as { data: any[] };
}
export async function getOrganization(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/iam/organizations/${id}`, { headers: authHeaders() });
  return data as { data: any };
}
export async function createOrganization(payload: {
  name: string;
  legalName?: string | null;
  taxId?: string | null;
  registrationNumber?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  status?: 'active' | 'inactive' | 'suspended';
}, logoFile?: File) {
  if (logoFile) {
    return createOrganizationWithLogo(payload, logoFile);
  }
  const { data } = await axios.post(`${API_BASE}/api/iam/organizations`, payload, { headers: authHeaders() });
  return data as { data: any };
}
export async function updateOrganization(id: string, payload: {
  name?: string;
  legalName?: string | null;
  taxId?: string | null;
  registrationNumber?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  status?: 'active' | 'inactive' | 'suspended';
}, logoFile?: File) {
  const formData = new FormData();

  // Add logo file if provided
  if (logoFile) {
    formData.append('logo', logoFile);
  }

  // Add other fields as JSON string (or append individually)
  Object.keys(payload).forEach(key => {
    const value = payload[key as keyof typeof payload];
    if (value !== undefined && value !== null) {
      formData.append(key, value.toString());
    }
  });

  const { data } = await axios.patch(`${API_BASE}/api/iam/organizations/${id}`, formData, {
    headers: {
      ...authHeaders(),
      'Content-Type': 'multipart/form-data'
    }
  });
  return data as { data: any };
}

export async function createOrganizationWithLogo(payload: {
  name: string;
  legalName?: string | null;
  taxId?: string | null;
  registrationNumber?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: 'active' | 'inactive' | 'suspended';
}, logoFile?: File) {
  const formData = new FormData();

  // Add logo file if provided
  if (logoFile) {
    formData.append('logo', logoFile);
  }

  // Add other fields
  Object.keys(payload).forEach(key => {
    const value = payload[key as keyof typeof payload];
    if (value !== undefined && value !== null) {
      formData.append(key, value.toString());
    }
  });

  const { data } = await axios.post(`${API_BASE}/api/iam/organizations`, formData, {
    headers: {
      ...authHeaders(),
      'Content-Type': 'multipart/form-data'
    }
  });
  return data as { data: any };
}

// PROFILE
export async function getCurrentUser() {
  const session = getSession();
  if (!session?.user?.id) throw new Error('No user session found');
  const { data } = await axios.get(`${API_BASE}/api/iam/users/${session.user.id}`, { headers: authHeaders() });
  return data as { data: any };
}

export async function updateCurrentUser(payload: Partial<{ email: string; username: string | null; firstName: string | null; lastName: string | null }>) {
  const session = getSession();
  if (!session?.user?.id) throw new Error('No user session found');
  const { data } = await axios.patch(`${API_BASE}/api/iam/users/${session.user.id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function changePassword(payload: { currentPassword: string; newPassword: string }) {
  const session = getSession();
  if (!session?.user?.id) throw new Error('No user session found');
  const { data } = await axios.patch(`${API_BASE}/api/iam/users/${session.user.id}/password`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function setPassword(payload: { password: string }) {
  const session = getSession();
  if (!session?.user?.id) throw new Error('No user session found');
  const { data } = await axios.post(`${API_BASE}/api/iam/users/${session.user.id}/password`, payload, { headers: authHeaders() });
  return data as { data: any };
}

// BUSINESS UNITS
export async function listBusinessUnits(organizationId?: string) {
  const params = organizationId ? `?organizationId=${organizationId}` : '';
  const { data } = await axios.get(`${API_BASE}/api/iam/business-units${params}`, { headers: authHeaders() });
  return data as { data: any[] };
}
export async function getBusinessUnit(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/iam/business-units/${id}`, { headers: authHeaders() });
  return data as { data: any };
}
export async function createBusinessUnit(payload: {
  organizationId: string;
  parentId?: string | null;
  code: string;
  name: string;
  type: 'wholesale' | 'retail' | 'ecommerce' | '3pl' | 'food_beverage' | 'other';
  status?: 'active' | 'inactive' | 'suspended';
  settings?: Record<string, any> | null;
}) {
  const { data } = await axios.post(`${API_BASE}/api/iam/business-units`, payload, { headers: authHeaders() });
  return data as { data: any };
}
export async function updateBusinessUnit(id: string, payload: {
  code?: string;
  name?: string;
  type?: 'wholesale' | 'retail' | 'ecommerce' | '3pl' | 'food_beverage' | 'other';
  status?: 'active' | 'inactive' | 'suspended';
  parentId?: string | null;
  settings?: Record<string, any> | null;
}) {
  const { data } = await axios.patch(`${API_BASE}/api/iam/business-units/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}
export async function deleteBusinessUnit(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/iam/business-units/${id}`, { headers: authHeaders() });
  return status === 204;
}

// LOCATIONS
export async function listLocations(businessUnitId?: string, organizationId?: string) {
  const params = new URLSearchParams();
  if (businessUnitId) params.append('businessUnitId', businessUnitId);
  if (organizationId) params.append('organizationId', organizationId);
  const query = params.toString() ? `?${params.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/iam/locations${query}`, { headers: authHeaders() });
  return data as { data: any[] };
}
export async function getLocation(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/iam/locations/${id}`, { headers: authHeaders() });
  return data as { data: any };
}
export async function createLocation(payload: {
  businessUnitId: string;
  code: string;
  name: string;
  type: 'warehouse' | 'store' | 'office' | 'distribution_center' | 'other';
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  countryCode: string;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  email?: string | null;
  timezone?: string;
  isDefault?: boolean;
  status?: 'active' | 'inactive';
}) {
  const { data } = await axios.post(`${API_BASE}/api/iam/locations`, payload, { headers: authHeaders() });
  return data as { data: any };
}
export async function updateLocation(id: string, payload: {
  code?: string;
  name?: string;
  type?: 'warehouse' | 'store' | 'office' | 'distribution_center' | 'other';
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  countryCode?: string;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  email?: string | null;
  timezone?: string;
  isDefault?: boolean;
  status?: 'active' | 'inactive';
}) {
  const { data } = await axios.patch(`${API_BASE}/api/iam/locations/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}
export async function deleteLocation(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/iam/locations/${id}`, { headers: authHeaders() });
  return status === 204;
}


