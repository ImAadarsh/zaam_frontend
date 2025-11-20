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
export async function createUser(payload: { organizationId: string; email: string; username?: string; firstName?: string; lastName?: string; status?: string }) {
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
export async function assignRole(payload: { userId: string; roleId: string; businessUnitId?: string; locationId?: string }) {
  const { data } = await axios.post(`${API_BASE}/api/iam/roles/assign`, payload, { headers: authHeaders() });
  return data as { data: any };
}

// API KEYS
export async function createApiKey(payload: { organizationId: string; name: string; scopes?: string[] }) {
  const { data } = await axios.post(`${API_BASE}/api/iam/api-keys`, payload, { headers: authHeaders() });
  return data as { data: { id: string; name: string; key: string; keyPrefix: string } };
}

// AUDIT LOGS
export async function listAuditLogs(limit = 50) {
  const { data } = await axios.get(`${API_BASE}/api/iam/audit-logs?limit=${limit}`, { headers: authHeaders() });
  return data as { data: any[] };
}


