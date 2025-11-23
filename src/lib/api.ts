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

// ============================================================================
// CATALOG API FUNCTIONS
// ============================================================================

// CATALOG ITEMS
export async function listCatalogItems(params?: {
  organizationId?: string;
  businessUnitId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.organizationId) queryParams.append('organizationId', params.organizationId);
  if (params?.businessUnitId) queryParams.append('businessUnitId', params.businessUnitId);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/catalog/items${query}`, { headers: authHeaders() });
  return data as { data: any[]; pagination?: any };
}

export async function getCatalogItem(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/catalog/items/${id}`, { headers: authHeaders() });
  return data as { data: any };
}

export async function createCatalogItem(payload: {
  organizationId: string;
  businessUnitId?: string;
  sku: string;
  name: string;
  description?: string;
  longDescription?: string;
  category?: string;
  brand?: string;
  manufacturer?: string;
  hsCode?: string;
  countryOfOrigin?: string;
  taxCodeId?: string;
  weightValue?: number;
  weightUnit?: 'g' | 'kg' | 'lb' | 'oz';
  lengthValue?: number;
  widthValue?: number;
  heightValue?: number;
  dimensionUnit?: 'cm' | 'm' | 'in' | 'ft';
  attributes?: Record<string, any>;
  status?: 'active' | 'inactive' | 'discontinued';
}) {
  const { data } = await axios.post(`${API_BASE}/api/catalog/items`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function updateCatalogItem(id: string, payload: {
  businessUnitId?: string;
  sku?: string;
  name?: string;
  description?: string;
  longDescription?: string;
  category?: string;
  brand?: string;
  manufacturer?: string;
  hsCode?: string;
  countryOfOrigin?: string;
  taxCodeId?: string;
  weightValue?: number;
  weightUnit?: 'g' | 'kg' | 'lb' | 'oz';
  lengthValue?: number;
  widthValue?: number;
  heightValue?: number;
  dimensionUnit?: 'cm' | 'm' | 'in' | 'ft';
  attributes?: Record<string, any>;
  status?: 'active' | 'inactive' | 'discontinued';
}) {
  const { data } = await axios.patch(`${API_BASE}/api/catalog/items/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function deleteCatalogItem(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/catalog/items/${id}`, { headers: authHeaders() });
  return status === 204;
}

// VARIANTS
export async function listVariants(params?: {
  catalogItemId?: string;
  status?: string;
  search?: string;
}) {
  const queryParams = new URLSearchParams();
  if (params?.catalogItemId) queryParams.append('catalogItemId', params.catalogItemId);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.search) queryParams.append('search', params.search);
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/catalog/variants${query}`, { headers: authHeaders() });
  return data as { data: any[] };
}

export async function getVariant(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/catalog/variants/${id}`, { headers: authHeaders() });
  return data as { data: any };
}

export async function createVariant(payload: {
  catalogItemId: string;
  variantSku: string;
  name?: string;
  option1Name?: string;
  option1Value?: string;
  option2Name?: string;
  option2Value?: string;
  option3Name?: string;
  option3Value?: string;
  weightValue?: number;
  weightUnit?: 'g' | 'kg' | 'lb' | 'oz';
  lengthValue?: number;
  widthValue?: number;
  heightValue?: number;
  dimensionUnit?: 'cm' | 'm' | 'in' | 'ft';
  costPrice?: number;
  costCurrency?: string;
  imageUrl?: string;
  position?: number;
  status?: 'active' | 'inactive' | 'discontinued';
}, imageFile?: File) {
  const formData = new FormData();
  if (imageFile) {
    formData.append('image', imageFile);
  }
  Object.keys(payload).forEach(key => {
    const value = payload[key as keyof typeof payload];
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });
  const { data } = await axios.post(`${API_BASE}/api/catalog/variants`, formData, {
    headers: {
      ...authHeaders(),
      'Content-Type': 'multipart/form-data'
    }
  });
  return data as { data: any };
}

export async function updateVariant(id: string, payload: {
  variantSku?: string;
  name?: string;
  option1Name?: string;
  option1Value?: string;
  option2Name?: string;
  option2Value?: string;
  option3Name?: string;
  option3Value?: string;
  weightValue?: number;
  weightUnit?: 'g' | 'kg' | 'lb' | 'oz';
  lengthValue?: number;
  widthValue?: number;
  heightValue?: number;
  dimensionUnit?: 'cm' | 'm' | 'in' | 'ft';
  costPrice?: number;
  costCurrency?: string;
  imageUrl?: string | null;
  position?: number;
  status?: 'active' | 'inactive' | 'discontinued';
}, imageFile?: File) {
  const formData = new FormData();
  if (imageFile) {
    formData.append('image', imageFile);
  }
  Object.keys(payload).forEach(key => {
    const value = payload[key as keyof typeof payload];
    if (value !== undefined && value !== null) {
      formData.append(key, value === null ? '' : String(value));
    }
  });
  const { data } = await axios.patch(`${API_BASE}/api/catalog/variants/${id}`, formData, {
    headers: {
      ...authHeaders(),
      'Content-Type': 'multipart/form-data'
    }
  });
  return data as { data: any };
}

export async function deleteVariant(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/catalog/variants/${id}`, { headers: authHeaders() });
  return status === 204;
}

// BARCODES
export async function listBarcodes(params?: {
  variantId?: string;
  type?: string;
  isPrimary?: boolean;
}) {
  const queryParams = new URLSearchParams();
  if (params?.variantId) queryParams.append('variantId', params.variantId);
  if (params?.type) queryParams.append('type', params.type);
  if (params?.isPrimary !== undefined) queryParams.append('isPrimary', params.isPrimary.toString());
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/catalog/barcodes${query}`, { headers: authHeaders() });
  return data as { data: any[] };
}

export async function createBarcode(payload: {
  variantId: string;
  barcode: string;
  type?: 'EAN' | 'UPC' | 'ISBN' | 'CODE128' | 'QR' | 'INTERNAL';
  isPrimary?: boolean;
}) {
  const { data } = await axios.post(`${API_BASE}/api/catalog/barcodes`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function updateBarcode(id: string, payload: {
  barcode?: string;
  type?: 'EAN' | 'UPC' | 'ISBN' | 'CODE128' | 'QR' | 'INTERNAL';
  isPrimary?: boolean;
}) {
  const { data } = await axios.patch(`${API_BASE}/api/catalog/barcodes/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function deleteBarcode(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/catalog/barcodes/${id}`, { headers: authHeaders() });
  return status === 204;
}

// TAX CODES
export async function listTaxCodes(params?: {
  organizationId?: string;
  countryCode?: string;
  status?: string;
}) {
  const queryParams = new URLSearchParams();
  if (params?.organizationId) queryParams.append('organizationId', params.organizationId);
  if (params?.countryCode) queryParams.append('countryCode', params.countryCode);
  if (params?.status) queryParams.append('status', params.status);
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/catalog/tax-codes${query}`, { headers: authHeaders() });
  return data as { data: any[] };
}

export async function getTaxCode(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/catalog/tax-codes/${id}`, { headers: authHeaders() });
  return data as { data: any };
}

export async function createTaxCode(payload: {
  organizationId: string;
  code: string;
  name: string;
  rate: number;
  countryCode?: string;
  description?: string;
  isDefault?: boolean;
  status?: 'active' | 'inactive';
}) {
  const { data } = await axios.post(`${API_BASE}/api/catalog/tax-codes`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function updateTaxCode(id: string, payload: {
  code?: string;
  name?: string;
  rate?: number;
  countryCode?: string;
  description?: string;
  isDefault?: boolean;
  status?: 'active' | 'inactive';
}) {
  const { data } = await axios.patch(`${API_BASE}/api/catalog/tax-codes/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function deleteTaxCode(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/catalog/tax-codes/${id}`, { headers: authHeaders() });
  return status === 204;
}

// PRICE LISTS
export async function listPriceLists(params?: {
  organizationId?: string;
  businessUnitId?: string;
  type?: string;
  status?: string;
}) {
  const queryParams = new URLSearchParams();
  if (params?.organizationId) queryParams.append('organizationId', params.organizationId);
  if (params?.businessUnitId) queryParams.append('businessUnitId', params.businessUnitId);
  if (params?.type) queryParams.append('type', params.type);
  if (params?.status) queryParams.append('status', params.status);
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/catalog/price-lists${query}`, { headers: authHeaders() });
  return data as { data: any[] };
}

export async function getPriceList(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/catalog/price-lists/${id}`, { headers: authHeaders() });
  return data as { data: any };
}

export async function createPriceList(payload: {
  organizationId: string;
  businessUnitId?: string;
  name: string;
  code: string;
  type: 'retail' | 'wholesale' | 'channel' | 'customer_tier' | 'region';
  currency?: string;
  description?: string;
  validFrom?: string;
  validUntil?: string;
  isDefault?: boolean;
  status?: 'active' | 'inactive';
}) {
  const { data } = await axios.post(`${API_BASE}/api/catalog/price-lists`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function updatePriceList(id: string, payload: {
  businessUnitId?: string;
  name?: string;
  code?: string;
  type?: 'retail' | 'wholesale' | 'channel' | 'customer_tier' | 'region';
  currency?: string;
  description?: string;
  validFrom?: string;
  validUntil?: string;
  isDefault?: boolean;
  status?: 'active' | 'inactive';
}) {
  const { data } = await axios.patch(`${API_BASE}/api/catalog/price-lists/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function deletePriceList(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/catalog/price-lists/${id}`, { headers: authHeaders() });
  return status === 204;
}

// PRICE LIST ITEMS
export async function listPriceListItems(params?: {
  priceListId?: string;
  variantId?: string;
}) {
  const queryParams = new URLSearchParams();
  if (params?.priceListId) queryParams.append('priceListId', params.priceListId);
  if (params?.variantId) queryParams.append('variantId', params.variantId);
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/catalog/price-list-items${query}`, { headers: authHeaders() });
  return data as { data: any[] };
}

export async function createPriceListItem(payload: {
  priceListId: string;
  variantId: string;
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  minMarginPercent?: number;
  minQuantity?: number;
  maxQuantity?: number;
}) {
  const { data } = await axios.post(`${API_BASE}/api/catalog/price-list-items`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function updatePriceListItem(id: string, payload: {
  price?: number;
  compareAtPrice?: number;
  costPrice?: number;
  minMarginPercent?: number;
  minQuantity?: number;
  maxQuantity?: number;
}) {
  const { data } = await axios.patch(`${API_BASE}/api/catalog/price-list-items/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function deletePriceListItem(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/catalog/price-list-items/${id}`, { headers: authHeaders() });
  return status === 204;
}

// PRODUCT MEDIA
export async function listProductMedia(params?: {
  catalogItemId?: string;
  variantId?: string;
  type?: 'image' | 'video' | 'document' | '3d_model';
}) {
  const queryParams = new URLSearchParams();
  if (params?.catalogItemId) queryParams.append('catalogItemId', params.catalogItemId);
  if (params?.variantId) queryParams.append('variantId', params.variantId);
  if (params?.type) queryParams.append('type', params.type);
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/catalog/media${query}`, { headers: authHeaders() });
  return data as { data: any[] };
}

export async function getProductMedia(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/catalog/media/${id}`, { headers: authHeaders() });
  return data as { data: any };
}

export async function createProductMedia(payload: {
  catalogItemId: string;
  variantId?: string;
  type: 'image' | 'video' | 'document' | '3d_model';
  altText?: string;
  position?: number;
  isPrimary?: boolean;
}, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  Object.keys(payload).forEach(key => {
    const value = payload[key as keyof typeof payload];
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });
  const { data } = await axios.post(`${API_BASE}/api/catalog/media`, formData, {
    headers: {
      ...authHeaders(),
      'Content-Type': 'multipart/form-data'
    }
  });
  return data as { data: any };
}

export async function updateProductMedia(id: string, payload: {
  variantId?: string | null;
  type?: 'image' | 'video' | 'document' | '3d_model';
  altText?: string;
  position?: number;
  isPrimary?: boolean;
}, file?: File) {
  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  }
  Object.keys(payload).forEach(key => {
    const value = payload[key as keyof typeof payload];
    if (value !== undefined && value !== null) {
      formData.append(key, value === null ? '' : String(value));
    }
  });
  const { data } = await axios.patch(`${API_BASE}/api/catalog/media/${id}`, formData, {
    headers: {
      ...authHeaders(),
      'Content-Type': 'multipart/form-data'
    }
  });
  return data as { data: any };
}

export async function deleteProductMedia(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/catalog/media/${id}`, { headers: authHeaders() });
  return status === 204;
}

// BUNDLES
export async function listBundles(params?: {
  catalogItemId?: string;
  status?: string;
}) {
  const queryParams = new URLSearchParams();
  if (params?.catalogItemId) queryParams.append('catalogItemId', params.catalogItemId);
  if (params?.status) queryParams.append('status', params.status);
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/catalog/bundles${query}`, { headers: authHeaders() });
  return data as { data: any[] };
}

export async function getBundle(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/catalog/bundles/${id}`, { headers: authHeaders() });
  return data as { data: any };
}

export async function createBundle(payload: {
  catalogItemId: string;
  name: string;
  description?: string;
  discountPercent?: number;
  fixedPrice?: number;
  currency?: string;
  status?: 'active' | 'inactive';
}) {
  const { data } = await axios.post(`${API_BASE}/api/catalog/bundles`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function updateBundle(id: string, payload: {
  name?: string;
  description?: string;
  discountPercent?: number;
  fixedPrice?: number;
  currency?: string;
  status?: 'active' | 'inactive';
}) {
  const { data } = await axios.patch(`${API_BASE}/api/catalog/bundles/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function deleteBundle(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/catalog/bundles/${id}`, { headers: authHeaders() });
  return status === 204;
}

// BUNDLE ITEMS
export async function listBundleItems(params?: {
  bundleId?: string;
  variantId?: string;
}) {
  const queryParams = new URLSearchParams();
  if (params?.bundleId) queryParams.append('bundleId', params.bundleId);
  if (params?.variantId) queryParams.append('variantId', params.variantId);
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/catalog/bundle-items${query}`, { headers: authHeaders() });
  return data as { data: any[] };
}

export async function getBundleItem(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/catalog/bundle-items/${id}`, { headers: authHeaders() });
  return data as { data: any };
}

export async function createBundleItem(payload: {
  bundleId: string;
  variantId: string;
  quantity?: number;
  position?: number;
}) {
  const { data } = await axios.post(`${API_BASE}/api/catalog/bundle-items`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function updateBundleItem(id: string, payload: {
  variantId?: string;
  quantity?: number;
  position?: number;
}) {
  const { data } = await axios.patch(`${API_BASE}/api/catalog/bundle-items/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function deleteBundleItem(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/catalog/bundle-items/${id}`, { headers: authHeaders() });
  return status === 204;
}

// PROMOTIONAL PRICES
export async function listPromotionalPrices(params?: {
  variantId?: string;
  priceListId?: string;
  status?: string;
}) {
  const queryParams = new URLSearchParams();
  if (params?.variantId) queryParams.append('variantId', params.variantId);
  if (params?.priceListId) queryParams.append('priceListId', params.priceListId);
  if (params?.status) queryParams.append('status', params.status);
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/catalog/promotional-prices${query}`, { headers: authHeaders() });
  return data as { data: any[] };
}

export async function getPromotionalPrice(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/catalog/promotional-prices/${id}`, { headers: authHeaders() });
  return data as { data: any };
}

export async function createPromotionalPrice(payload: {
  variantId: string;
  priceListId?: string;
  name: string;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  validFrom: string;
  validUntil: string;
  status?: 'scheduled' | 'active' | 'expired' | 'cancelled';
}) {
  const { data } = await axios.post(`${API_BASE}/api/catalog/promotional-prices`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function updatePromotionalPrice(id: string, payload: {
  priceListId?: string | null;
  name?: string;
  discountType?: 'percentage' | 'fixed_amount';
  discountValue?: number;
  validFrom?: string;
  validUntil?: string;
  status?: 'scheduled' | 'active' | 'expired' | 'cancelled';
}) {
  const { data } = await axios.patch(`${API_BASE}/api/catalog/promotional-prices/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function deletePromotionalPrice(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/catalog/promotional-prices/${id}`, { headers: authHeaders() });
  return status === 204;
}

// CHANNEL MAPPINGS
export async function listChannelMappings(params?: {
  catalogItemId?: string;
  variantId?: string;
  channel?: string;
  syncStatus?: string;
}) {
  const queryParams = new URLSearchParams();
  if (params?.catalogItemId) queryParams.append('catalogItemId', params.catalogItemId);
  if (params?.variantId) queryParams.append('variantId', params.variantId);
  if (params?.channel) queryParams.append('channel', params.channel);
  if (params?.syncStatus) queryParams.append('syncStatus', params.syncStatus);
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/catalog/channel-mappings${query}`, { headers: authHeaders() });
  return data as { data: any[] };
}

export async function getChannelMapping(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/catalog/channel-mappings/${id}`, { headers: authHeaders() });
  return data as { data: any };
}

export async function createChannelMapping(payload: {
  catalogItemId: string;
  variantId?: string;
  channel: 'amazon' | 'ebay' | 'tiktok' | 'etsy' | 'shopify' | 'woocommerce' | 'wix' | 'b2b_portal' | 'pos';
  channelProductId?: string;
  channelVariantId?: string;
  channelUrl?: string;
  attributes?: Record<string, any>;
  syncEnabled?: boolean;
  syncStatus?: 'pending' | 'synced' | 'failed' | 'disabled';
}) {
  const { data } = await axios.post(`${API_BASE}/api/catalog/channel-mappings`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function updateChannelMapping(id: string, payload: {
  variantId?: string | null;
  channelProductId?: string;
  channelVariantId?: string;
  channelUrl?: string;
  attributes?: Record<string, any>;
  syncEnabled?: boolean;
  syncStatus?: 'pending' | 'synced' | 'failed' | 'disabled';
  syncError?: string;
}) {
  const { data } = await axios.patch(`${API_BASE}/api/catalog/channel-mappings/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function deleteChannelMapping(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/catalog/channel-mappings/${id}`, { headers: authHeaders() });
  return status === 204;
}

// COMPLIANCE DOCUMENTS
export async function listComplianceDocuments(params?: {
  catalogItemId?: string;
  type?: string;
  status?: string;
}) {
  const queryParams = new URLSearchParams();
  if (params?.catalogItemId) queryParams.append('catalogItemId', params.catalogItemId);
  if (params?.type) queryParams.append('type', params.type);
  if (params?.status) queryParams.append('status', params.status);
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/catalog/compliance-documents${query}`, { headers: authHeaders() });
  return data as { data: any[] };
}

export async function getComplianceDocument(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/catalog/compliance-documents/${id}`, { headers: authHeaders() });
  return data as { data: any };
}

export async function createComplianceDocument(payload: {
  catalogItemId: string;
  type: 'msds' | 'certificate' | 'safety_data' | 'test_report' | 'other';
  name: string;
  documentNumber?: string;
  issuer?: string;
  issuedDate?: string;
  expiryDate?: string;
  status?: 'active' | 'expired' | 'pending';
}, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  Object.keys(payload).forEach(key => {
    const value = payload[key as keyof typeof payload];
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });
  const { data } = await axios.post(`${API_BASE}/api/catalog/compliance-documents`, formData, {
    headers: {
      ...authHeaders(),
      'Content-Type': 'multipart/form-data'
    }
  });
  return data as { data: any };
}

export async function updateComplianceDocument(id: string, payload: {
  type?: 'msds' | 'certificate' | 'safety_data' | 'test_report' | 'other';
  name?: string;
  documentNumber?: string;
  issuer?: string;
  issuedDate?: string;
  expiryDate?: string;
  status?: 'active' | 'expired' | 'pending';
}, file?: File) {
  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  }
  Object.keys(payload).forEach(key => {
    const value = payload[key as keyof typeof payload];
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });
  const { data } = await axios.patch(`${API_BASE}/api/catalog/compliance-documents/${id}`, formData, {
    headers: {
      ...authHeaders(),
      'Content-Type': 'multipart/form-data'
    }
  });
  return data as { data: any };
}

export async function deleteComplianceDocument(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/catalog/compliance-documents/${id}`, { headers: authHeaders() });
  return status === 204;
}


