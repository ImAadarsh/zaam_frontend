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

// ============================================================================
// INVENTORY API FUNCTIONS
// ============================================================================

// WAREHOUSES
export async function listWarehouses(params?: {
  locationId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.locationId) queryParams.append('locationId', params.locationId);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/inventory/warehouses${query}`, { headers: authHeaders() });
  return data as { data: any[]; pagination?: any };
}

export async function getWarehouse(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/inventory/warehouses/${id}`, { headers: authHeaders() });
  return data as { data: any };
}

export async function createWarehouse(payload: {
  locationId: string;
  code: string;
  name: string;
  type: 'main_hub' | 'distribution_center' | 'store' | 'third_party' | 'other';
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  countryCode: string;
  capacityCubicMeters?: number;
  isDefault?: boolean;
  status?: 'active' | 'inactive' | 'maintenance';
}) {
  const { data } = await axios.post(`${API_BASE}/api/inventory/warehouses`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function updateWarehouse(id: string, payload: {
  code?: string;
  name?: string;
  type?: 'main_hub' | 'distribution_center' | 'store' | 'third_party' | 'other';
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  countryCode?: string;
  capacityCubicMeters?: number;
  isDefault?: boolean;
  status?: 'active' | 'inactive' | 'maintenance';
}) {
  const { data } = await axios.patch(`${API_BASE}/api/inventory/warehouses/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function deleteWarehouse(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/inventory/warehouses/${id}`, { headers: authHeaders() });
  return status === 204;
}

// BINS
export async function listBins(params?: {
  warehouseId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.warehouseId) queryParams.append('warehouseId', params.warehouseId);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/inventory/bins${query}`, { headers: authHeaders() });
  return data as { data: any[]; pagination?: any };
}

export async function getBin(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/inventory/bins/${id}`, { headers: authHeaders() });
  return data as { data: any };
}

export async function createBin(payload: {
  warehouseId: string;
  code: string;
  name?: string;
  zone?: string;
  aisle?: string;
  rack?: string;
  shelf?: string;
  binType?: 'standard' | 'bulk' | 'cold_storage' | 'hazmat' | 'quarantine' | 'staging' | 'returns';
  capacityCubicMeters?: number;
  maxWeightKg?: number;
  barcode?: string;
  status?: 'active' | 'inactive' | 'full' | 'maintenance';
}) {
  const { data } = await axios.post(`${API_BASE}/api/inventory/bins`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function updateBin(id: string, payload: {
  code?: string;
  name?: string;
  zone?: string;
  aisle?: string;
  rack?: string;
  shelf?: string;
  binType?: 'standard' | 'bulk' | 'cold_storage' | 'hazmat' | 'quarantine' | 'staging' | 'returns';
  capacityCubicMeters?: number;
  maxWeightKg?: number;
  barcode?: string;
  status?: 'active' | 'inactive' | 'full' | 'maintenance';
}) {
  const { data } = await axios.patch(`${API_BASE}/api/inventory/bins/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function deleteBin(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/inventory/bins/${id}`, { headers: authHeaders() });
  return status === 204;
}

// SUPPLIERS
export async function listSuppliers(params?: {
  organizationId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.organizationId) queryParams.append('organizationId', params.organizationId);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/inventory/suppliers${query}`, { headers: authHeaders() });
  return data as { data: any[]; pagination?: any };
}

export async function getSupplier(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/inventory/suppliers/${id}`, { headers: authHeaders() });
  return data as { data: any };
}

export async function createSupplier(payload: {
  organizationId: string;
  code: string;
  name: string;
  legalName?: string;
  email?: string;
  phone?: string;
  website?: string;
  taxId?: string;
  paymentTerms?: string;
  currency?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  countryCode?: string;
  leadTimeDays?: number;
  minimumOrderValue?: number;
  rating?: number;
  notes?: string;
  status?: 'active' | 'inactive' | 'blocked';
}) {
  const { data } = await axios.post(`${API_BASE}/api/inventory/suppliers`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function updateSupplier(id: string, payload: {
  code?: string;
  name?: string;
  legalName?: string;
  email?: string;
  phone?: string;
  website?: string;
  taxId?: string;
  paymentTerms?: string;
  currency?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  countryCode?: string;
  leadTimeDays?: number;
  minimumOrderValue?: number;
  rating?: number;
  notes?: string;
  status?: 'active' | 'inactive' | 'blocked';
}) {
  const { data } = await axios.patch(`${API_BASE}/api/inventory/suppliers/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function deleteSupplier(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/inventory/suppliers/${id}`, { headers: authHeaders() });
  return status === 204;
}

// PURCHASE ORDERS
export async function listPurchaseOrders(params?: {
  organizationId?: string;
  supplierId?: string;
  warehouseId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.organizationId) queryParams.append('organizationId', params.organizationId);
  if (params?.supplierId) queryParams.append('supplierId', params.supplierId);
  if (params?.warehouseId) queryParams.append('warehouseId', params.warehouseId);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/inventory/purchase-orders${query}`, { headers: authHeaders() });
  return data as { data: any[]; pagination?: any };
}

export async function getPurchaseOrder(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/inventory/purchase-orders/${id}`, { headers: authHeaders() });
  return data as { data: any };
}

export async function createPurchaseOrder(payload: {
  organizationId: string;
  supplierId: string;
  warehouseId: string;
  poNumber: string;
  reference?: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  currency?: string;
  subtotal?: number;
  taxAmount?: number;
  shippingCost?: number;
  otherCosts?: number;
  total?: number;
  status?: 'draft' | 'submitted' | 'confirmed' | 'partial_received' | 'received' | 'cancelled';
  notes?: string;
}) {
  const { data } = await axios.post(`${API_BASE}/api/inventory/purchase-orders`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function updatePurchaseOrder(id: string, payload: {
  poNumber?: string;
  reference?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  currency?: string;
  subtotal?: number;
  taxAmount?: number;
  shippingCost?: number;
  otherCosts?: number;
  total?: number;
  status?: 'draft' | 'submitted' | 'confirmed' | 'partial_received' | 'received' | 'cancelled';
  notes?: string;
}) {
  const { data } = await axios.patch(`${API_BASE}/api/inventory/purchase-orders/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function deletePurchaseOrder(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/inventory/purchase-orders/${id}`, { headers: authHeaders() });
  return status === 204;
}

// STOCK ITEMS
export async function listStockItems(params?: {
  variantId?: string;
  warehouseId?: string;
  binId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.variantId) queryParams.append('variantId', params.variantId);
  if (params?.warehouseId) queryParams.append('warehouseId', params.warehouseId);
  if (params?.binId) queryParams.append('binId', params.binId);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/inventory/stock-items${query}`, { headers: authHeaders() });
  return data as { data: any[]; pagination?: any };
}

export async function getStockItem(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/inventory/stock-items/${id}`, { headers: authHeaders() });
  return data as { data: any };
}

export async function createStockItem(payload: {
  variantId: string;
  warehouseId: string;
  binId?: string;
  lotNumber?: string;
  serialNumber?: string;
  expiryDate?: string;
  manufactureDate?: string;
  quantityOnHand?: number;
  quantityReserved?: number;
  safetyStockLevel?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  status?: 'available' | 'reserved' | 'quarantine' | 'damaged' | 'expired';
  costPrice?: number;
}) {
  const { data } = await axios.post(`${API_BASE}/api/inventory/stock-items`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function updateStockItem(id: string, payload: {
  binId?: string;
  lotNumber?: string;
  serialNumber?: string;
  expiryDate?: string;
  manufactureDate?: string;
  quantityOnHand?: number;
  quantityReserved?: number;
  safetyStockLevel?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  status?: 'available' | 'reserved' | 'quarantine' | 'damaged' | 'expired';
  costPrice?: number;
}) {
  const { data } = await axios.patch(`${API_BASE}/api/inventory/stock-items/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function deleteStockItem(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/inventory/stock-items/${id}`, { headers: authHeaders() });
  return status === 204;
}

// ASN (Advanced Shipping Notices)
export async function listASN(params?: {
  organizationId?: string;
  purchaseOrderId?: string;
  supplierId?: string;
  warehouseId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.organizationId) queryParams.append('organizationId', params.organizationId);
  if (params?.purchaseOrderId) queryParams.append('purchaseOrderId', params.purchaseOrderId);
  if (params?.supplierId) queryParams.append('supplierId', params.supplierId);
  if (params?.warehouseId) queryParams.append('warehouseId', params.warehouseId);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/inventory/asn${query}`, { headers: authHeaders() });
  return data as { data: any[]; pagination?: any };
}

export async function getASN(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/inventory/asn/${id}`, { headers: authHeaders() });
  return data as { data: any };
}

export async function createASN(payload: {
  organizationId: string;
  purchaseOrderId?: string;
  supplierId: string;
  warehouseId: string;
  asnNumber: string;
  reference?: string;
  expectedDate: string;
  carrier?: string;
  trackingNumber?: string;
  totalPallets?: number;
  totalCartons?: number;
  status?: 'pending' | 'in_transit' | 'arrived' | 'receiving' | 'completed' | 'cancelled';
  notes?: string;
}) {
  const { data } = await axios.post(`${API_BASE}/api/inventory/asn`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function updateASN(id: string, payload: {
  asnNumber?: string;
  reference?: string;
  expectedDate?: string;
  carrier?: string;
  trackingNumber?: string;
  totalPallets?: number;
  totalCartons?: number;
  status?: 'pending' | 'in_transit' | 'arrived' | 'receiving' | 'completed' | 'cancelled';
  notes?: string;
}) {
  const { data } = await axios.patch(`${API_BASE}/api/inventory/asn/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function deleteASN(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/inventory/asn/${id}`, { headers: authHeaders() });
  return status === 204;
}

// GRN (Goods Receipt Notes)
export async function listGRN(params?: {
  organizationId?: string;
  asnId?: string;
  purchaseOrderId?: string;
  warehouseId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.organizationId) queryParams.append('organizationId', params.organizationId);
  if (params?.asnId) queryParams.append('asnId', params.asnId);
  if (params?.purchaseOrderId) queryParams.append('purchaseOrderId', params.purchaseOrderId);
  if (params?.warehouseId) queryParams.append('warehouseId', params.warehouseId);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/inventory/grn${query}`, { headers: authHeaders() });
  return data as { data: any[]; pagination?: any };
}

export async function getGRN(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/inventory/grn/${id}`, { headers: authHeaders() });
  return data as { data: any };
}

export async function createGRN(payload: {
  organizationId: string;
  asnId?: string;
  purchaseOrderId?: string;
  warehouseId: string;
  grnNumber: string;
  receivedDate: string;
  receivedById: string;
  status?: 'draft' | 'qa_pending' | 'approved' | 'rejected' | 'put_away';
  notes?: string;
  lines: Array<{
    purchaseOrderLineId?: string;
    variantId: string;
    quantityExpected: number;
    quantityReceived: number;
    quantityRejected?: number;
    lotNumber?: string;
    serialNumbers?: string;
    expiryDate?: string;
    qaStatus?: 'pending' | 'passed' | 'failed' | 'quarantine';
    qaNotes?: string;
  }>;
}) {
  const { data } = await axios.post(`${API_BASE}/api/inventory/grn`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function updateGRN(id: string, payload: {
  grnNumber?: string;
  receivedDate?: string;
  status?: 'draft' | 'qa_pending' | 'approved' | 'rejected' | 'put_away';
  notes?: string;
  lines?: Array<{
    purchaseOrderLineId?: string;
    variantId: string;
    quantityExpected: number;
    quantityReceived: number;
    quantityRejected?: number;
    lotNumber?: string;
    serialNumbers?: string;
    expiryDate?: string;
    qaStatus?: 'pending' | 'passed' | 'failed' | 'quarantine';
    qaNotes?: string;
  }>;
}) {
  const { data } = await axios.patch(`${API_BASE}/api/inventory/grn/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function deleteGRN(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/inventory/grn/${id}`, { headers: authHeaders() });
  return status === 204;
}

// Stock Transfers
export async function listStockTransfers(params?: {
  organizationId?: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.organizationId) queryParams.append('organizationId', params.organizationId);
  if (params?.fromWarehouseId) queryParams.append('fromWarehouseId', params.fromWarehouseId);
  if (params?.toWarehouseId) queryParams.append('toWarehouseId', params.toWarehouseId);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/inventory/stock-transfers${query}`, { headers: authHeaders() });
  return data as { data: any[]; pagination?: any };
}

export async function getStockTransfer(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/inventory/stock-transfers/${id}`, { headers: authHeaders() });
  return data as { data: any };
}

export async function createStockTransfer(payload: {
  organizationId: string;
  transferNumber: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  transferDate: string;
  expectedArrivalDate?: string;
  status?: 'draft' | 'submitted' | 'in_transit' | 'received' | 'cancelled';
  notes?: string;
  lines: Array<{
    variantId: string;
    lotNumber?: string;
    quantitySent: number;
    notes?: string;
  }>;
}) {
  const { data } = await axios.post(`${API_BASE}/api/inventory/stock-transfers`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function updateStockTransfer(id: string, payload: {
  transferNumber?: string;
  transferDate?: string;
  expectedArrivalDate?: string;
  status?: 'draft' | 'submitted' | 'in_transit' | 'received' | 'cancelled';
  notes?: string;
  lines?: Array<{
    variantId: string;
    lotNumber?: string;
    quantitySent: number;
    notes?: string;
  }>;
}) {
  const { data } = await axios.patch(`${API_BASE}/api/inventory/stock-transfers/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function deleteStockTransfer(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/inventory/stock-transfers/${id}`, { headers: authHeaders() });
  return status === 204;
}

// Stock Adjustments
export async function listStockAdjustments(params?: {
  organizationId?: string;
  stockItemId?: string;
  adjustmentType?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.organizationId) queryParams.append('organizationId', params.organizationId);
  if (params?.stockItemId) queryParams.append('stockItemId', params.stockItemId);
  if (params?.adjustmentType) queryParams.append('adjustmentType', params.adjustmentType);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/inventory/stock-adjustments${query}`, { headers: authHeaders() });
  return data as { data: any[]; pagination?: any };
}

export async function getStockAdjustment(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/inventory/stock-adjustments/${id}`, { headers: authHeaders() });
  return data as { data: any };
}

export async function createStockAdjustment(payload: {
  organizationId: string;
  stockItemId: string;
  adjustmentNumber: string;
  adjustmentDate: string;
  adjustmentType: 'increase' | 'decrease' | 'correction' | 'write_off' | 'found' | 'damaged';
  quantityChange: number;
  reason: string;
  costImpact?: number;
  adjustedById: string;
}) {
  const { data } = await axios.post(`${API_BASE}/api/inventory/stock-adjustments`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function updateStockAdjustment(id: string, payload: {
  adjustmentNumber?: string;
  adjustmentDate?: string;
  adjustmentType?: 'increase' | 'decrease' | 'correction' | 'write_off' | 'found' | 'damaged';
  quantityChange?: number;
  reason?: string;
  costImpact?: number;
  approvedById?: string;
}) {
  const { data } = await axios.patch(`${API_BASE}/api/inventory/stock-adjustments/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function deleteStockAdjustment(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/inventory/stock-adjustments/${id}`, { headers: authHeaders() });
  return status === 204;
}

// Cycle Counts
export async function listCycleCounts(params?: {
  organizationId?: string;
  warehouseId?: string;
  status?: string;
  countType?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.organizationId) queryParams.append('organizationId', params.organizationId);
  if (params?.warehouseId) queryParams.append('warehouseId', params.warehouseId);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.countType) queryParams.append('countType', params.countType);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const { data } = await axios.get(`${API_BASE}/api/inventory/cycle-counts${query}`, { headers: authHeaders() });
  return data as { data: any[]; pagination?: any };
}

export async function getCycleCount(id: string) {
  const { data } = await axios.get(`${API_BASE}/api/inventory/cycle-counts/${id}`, { headers: authHeaders() });
  return data as { data: any };
}

export async function createCycleCount(payload: {
  organizationId: string;
  warehouseId: string;
  countNumber: string;
  countDate: string;
  countType: 'full' | 'partial' | 'abc_class_a' | 'abc_class_b' | 'abc_class_c' | 'spot_check';
  status?: 'planned' | 'in_progress' | 'completed' | 'reconciled' | 'cancelled';
  assignedToId?: string;
  notes?: string;
  lines?: Array<{
    stockItemId: string;
    expectedQuantity: number;
    countedQuantity?: number;
    notes?: string;
  }>;
}) {
  const { data } = await axios.post(`${API_BASE}/api/inventory/cycle-counts`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function updateCycleCount(id: string, payload: {
  countNumber?: string;
  countDate?: string;
  countType?: 'full' | 'partial' | 'abc_class_a' | 'abc_class_b' | 'abc_class_c' | 'spot_check';
  status?: 'planned' | 'in_progress' | 'completed' | 'reconciled' | 'cancelled';
  assignedToId?: string;
  completedById?: string;
  notes?: string;
  lines?: Array<{
    stockItemId: string;
    expectedQuantity: number;
    countedQuantity?: number;
    notes?: string;
  }>;
}) {
  const { data } = await axios.patch(`${API_BASE}/api/inventory/cycle-counts/${id}`, payload, { headers: authHeaders() });
  return data as { data: any };
}

export async function deleteCycleCount(id: string) {
  const { status } = await axios.delete(`${API_BASE}/api/inventory/cycle-counts/${id}`, { headers: authHeaders() });
  return status === 204;
}


