// InvoiceFlow AI - Core API Client

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  email_verified: boolean;
  is_superuser: boolean;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id?: string;
  email?: string;
  phone?: string;
  address?: string;
  country: string;
  currency: string;
  timezone: string;
  tax_id?: string;
  logo_url?: string;
  invoice_prefix: string;
  next_invoice_number: string;
  payment_instructions?: string;
  user_role?: "owner" | "admin" | "member";
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  status: "active" | "invited" | "suspended";
  user_email?: string;
  user_name?: string;
  created_at: string;
}

export interface OrganizationDetail extends Organization {
  members: OrganizationMember[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
  active_organization: Organization | null;
}

class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("invoiceflow_token");
}

export function setStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem("invoiceflow_token", token);
  } else {
    localStorage.removeItem("invoiceflow_token");
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}/api/v1${endpoint}`;
  const token = getStoredToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // If running in browser and on a protected route, trigger session cleanup
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/register")) {
      setStoredToken(null);
      // Let caller handle or redirect
    }
  }

  let data;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    let errorMessage = "An unexpected error occurred.";
    if (data && typeof data === "object") {
      if (typeof data.detail === "string") {
        errorMessage = data.detail;
      } else if (Array.isArray(data.detail)) {
        errorMessage = data.detail.map((d: any) => d.msg || "Invalid field").join(", ");
      }
    }
    throw new ApiError(response.status, errorMessage, data);
  }

  return data as T;
}

export interface Client {
  id: string;
  organization_id: string;
  name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  billing_address?: string | null;
  country: string;
  tax_id?: string | null;
  notes?: string | null;
  is_archived: boolean;
  total_invoiced: number;
  outstanding_balance: number;
  created_at: string;
  updated_at: string;
  invoices?: Invoice[];
}

export interface ClientCreate {
  name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  billing_address?: string | null;
  country?: string;
  tax_id?: string | null;
  notes?: string | null;
}

export interface ClientListResponse {
  items: Client[];
  total: number;
  skip: number;
  limit: number;
}

export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
  line_subtotal?: number;
  line_discount?: number;
  line_tax?: number;
  line_total?: number;
  display_order?: number;
}

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "sent"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

export interface Invoice {
  id: string;
  organization_id: string;
  client_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  effective_status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  notes?: string | null;
  payment_terms?: string | null;
  issued_at?: string | null;
  cancellation_reason?: string | null;
  public_token: string;
  public_token_active: boolean;
  created_at: string;
  updated_at: string;
  items: InvoiceItem[];
  client?: Client;
}

export interface InvoiceCreate {
  client_id: string;
  issue_date: string;
  due_date: string;
  currency?: string;
  notes?: string | null;
  payment_terms?: string | null;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    discount_percent?: number;
    tax_rate?: number;
    display_order?: number;
  }>;
}

export interface InvoiceListResponse {
  items: Invoice[];
  total: number;
  skip: number;
  limit: number;
}

export interface Payment {
  id: string;
  organization_id: string;
  invoice_id: string;
  payment_number?: string;
  amount: string | number;
  currency: string;
  payment_date: string;
  payment_method: string;
  reference?: string;
  notes?: string;
  payment_status: "completed" | "reversed" | "failed";
  is_manual: boolean;
  created_by_user_id?: string;
  reversal_reason?: string;
  reversed_at?: string;
  reversed_by_user_id?: string;
  idempotency_key?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentCreate {
  invoice_id: string;
  amount: number | string;
  payment_date: string;
  payment_method: string;
  reference?: string;
  notes?: string;
  is_manual?: boolean;
  idempotency_key?: string;
}

export interface PaymentListResponse {
  items: Payment[];
  total: number;
  skip: number;
  limit: number;
}

export interface EmailLog {
  id: string;
  organization_id: string;
  invoice_id?: string;
  client_id?: string;
  notification_type: "invoice_send" | "payment_reminder" | "payment_receipt" | "manual";
  recipient_email: string;
  subject: string;
  delivery_status: "queued" | "processing" | "accepted_by_provider" | "failed";
  provider_message_id?: string;
  attempt_count: number;
  last_attempt_at: string;
  error_message?: string;
  idempotency_key?: string;
  sent_at?: string;
  created_at: string;
}

export interface EmailLogListResponse {
  items: EmailLog[];
  total: number;
  skip: number;
  limit: number;
}

export interface AgingBracketSummary {
  bracket: string;
  label: string;
  total_balance: string | number;
  invoice_count: number;
}

export interface ReceivablesInvoiceItem {
  id: string;
  invoice_number: string;
  client_id: string;
  client_name: string;
  issue_date: string;
  due_date: string;
  currency: string;
  total_amount: string | number;
  amount_paid: string | number;
  balance_due: string | number;
  status: string;
  effective_status: string;
  days_overdue: number;
  aging_bracket: string;
  latest_reminder_date?: string;
}

export interface ReceivablesSummaryResponse {
  total_receivables: string | number;
  total_overdue: string | number;
  total_collected: string | number;
  total_open_invoices: number;
  total_overdue_invoices: number;
  brackets: AgingBracketSummary[];
  invoices: ReceivablesInvoiceItem[];
  total: number;
  skip: number;
  limit: number;
}


export interface MomChangeMetric {
  current: string | number;
  prior: string | number;
  absolute_change: string | number;
  percentage_change: string | number | null;
}

export interface AnalyticsSummaryResponse {
  currency: string;
  start_date: string;
  end_date: string;
  invoiced_amount: string | number;
  payments_collected: string | number;
  outstanding_receivables: string | number;
  overdue_receivables: string | number;
  partially_paid_amount: string | number;
  collection_rate: string | number;
  average_collection_days: string | number | null;
  active_invoices_count: number;
  overdue_invoices_count: number;
  paid_invoices_count: number;
  mom_invoiced: MomChangeMetric;
  mom_collected: MomChangeMetric;
}

export interface MonthlyTrendItem {
  period: string;
  period_label: string;
  invoiced_amount: string | number;
  collected_amount: string | number;
  net_difference: string | number;
  invoice_count: number;
  payment_count: number;
}

export interface RevenueTrendsResponse {
  currency: string;
  items: MonthlyTrendItem[];
  total_invoiced: string | number;
  total_collected: string | number;
}

export interface AgingBracketMetric {
  bracket: string;
  label: string;
  total_balance: string | number;
  invoice_count: number;
  percentage_of_receivables: string | number;
}

export interface AgingAnalyticsResponse {
  currency: string;
  total_receivables: string | number;
  total_overdue: string | number;
  brackets: AgingBracketMetric[];
}

export interface StatusDistributionItem {
  status: string;
  label: string;
  count: number;
  total_amount: string | number;
  percentage: string | number;
}

export interface StatusDistributionResponse {
  currency: string;
  total_invoices: number;
  items: StatusDistributionItem[];
}

export interface ClientPerformanceItem {
  client_id: string;
  client_name: string;
  email: string | null;
  currency: string;
  total_invoiced: string | number;
  total_collected: string | number;
  outstanding_balance: string | number;
  overdue_balance: string | number;
  invoice_count: number;
  overdue_invoice_count: number;
  average_settlement_days: string | number | null;
  latest_payment_date: string | null;
}

export interface ClientPerformanceResponse {
  items: ClientPerformanceItem[];
  total: number;
  skip: number;
  limit: number;
}

export interface AISummaryResponse {
  summary: string;
  key_insights: string[];
  recommended_actions: string[];
  is_mock: boolean;
  provider: string;
  generated_at: string;
}

export interface AIDraftReminderResponse {
  invoice_id: string;
  invoice_number: string;
  client_name: string;
  recipient_email: string;
  balance_due: string;
  currency: string;
  due_date: string;
  subject: string;
  body: string;
  tone: string;
  is_mock: boolean;
}

export interface AINaturalQueryResponse {
  query: string;
  intent: string;
  answer: string;
  supporting_data: Record<string, any>;
  is_mock: boolean;
  generated_at: string;
}

export const api = {
  auth: {
    register: (body: { email: string; password: string; full_name: string; organization_name?: string }) =>
      request<TokenResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    login: (body: { email: string; password: string }) =>
      request<TokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    logout: () =>
      request<{ message: string }>("/auth/logout", {
        method: "POST",
      }),

    getMe: () => request<User>("/auth/me"),
  },

  organizations: {
    list: () => request<Organization[]>("/organizations"),

    create: (body: Partial<Organization>) =>
      request<Organization>("/organizations", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    get: (id: string) => request<OrganizationDetail>(`/organizations/${id}`),

    update: (id: string, body: Partial<Organization>) =>
      request<Organization>(`/organizations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  },

  clients: {
    list: async (orgId: string, params?: { skip?: number; limit?: number; search?: string; is_archived?: boolean }): Promise<ClientListResponse> => {
      const qs = new URLSearchParams();
      if (params?.skip !== undefined) qs.set("skip", String(params.skip));
      if (params?.limit !== undefined) qs.set("limit", String(params.limit));
      if (params?.search) qs.set("search", params.search);
      if (params?.is_archived !== undefined) qs.set("is_archived", String(params.is_archived));
      const q = qs.toString() ? `?${qs.toString()}` : "";
      const raw = await request<any>(`/organizations/${orgId}/clients${q}`);
      if (Array.isArray(raw)) {
        return {
          items: raw,
          total: raw.length,
          skip: params?.skip || 0,
          limit: params?.limit || raw.length,
        };
      }
      return raw as ClientListResponse;
    },

    get: (orgId: string, clientId: string) =>
      request<Client>(`/organizations/${orgId}/clients/${clientId}`),

    create: (orgId: string, body: ClientCreate) =>
      request<Client>(`/organizations/${orgId}/clients`, {
        method: "POST",
        body: JSON.stringify(body),
      }),

    update: (orgId: string, clientId: string, body: Partial<ClientCreate>) =>
      request<Client>(`/organizations/${orgId}/clients/${clientId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),

    archive: (orgId: string, clientId: string) =>
      request<Client>(`/organizations/${orgId}/clients/${clientId}/archive`, {
        method: "POST",
      }),

    restore: (orgId: string, clientId: string) =>
      request<Client>(`/organizations/${orgId}/clients/${clientId}/restore`, {
        method: "POST",
      }),

    invoices: async (orgId: string, clientId: string, params?: { skip?: number; limit?: number }): Promise<InvoiceListResponse> => {
      const qs = new URLSearchParams();
      if (params?.skip !== undefined) qs.set("skip", String(params.skip));
      if (params?.limit !== undefined) qs.set("limit", String(params.limit));
      const q = qs.toString() ? `?${qs.toString()}` : "";
      const raw = await request<any>(`/organizations/${orgId}/clients/${clientId}/invoices${q}`);
      if (Array.isArray(raw)) {
        return {
          items: raw,
          total: raw.length,
          skip: params?.skip || 0,
          limit: params?.limit || raw.length,
        };
      }
      return raw as InvoiceListResponse;
    },
  },

  invoices: {
    list: (orgId: string, params?: { skip?: number; limit?: number; status?: string; client_id?: string; search?: string }) => {
      const qs = new URLSearchParams();
      if (params?.skip !== undefined) qs.set("skip", String(params.skip));
      if (params?.limit !== undefined) qs.set("limit", String(params.limit));
      if (params?.status) qs.set("status", params.status);
      if (params?.client_id) qs.set("client_id", params.client_id);
      if (params?.search) qs.set("search", params.search);
      const q = qs.toString() ? `?${qs.toString()}` : "";
      return request<InvoiceListResponse>(`/organizations/${orgId}/invoices${q}`);
    },

    get: (orgId: string, invoiceId: string) =>
      request<Invoice>(`/organizations/${orgId}/invoices/${invoiceId}`),

    create: (orgId: string, body: InvoiceCreate) =>
      request<Invoice>(`/organizations/${orgId}/invoices`, {
        method: "POST",
        body: JSON.stringify(body),
      }),

    update: (orgId: string, invoiceId: string, body: Partial<InvoiceCreate>) =>
      request<Invoice>(`/organizations/${orgId}/invoices/${invoiceId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),

    issue: (orgId: string, invoiceId: string) =>
      request<Invoice>(`/organizations/${orgId}/invoices/${invoiceId}/issue`, {
        method: "POST",
      }),

    cancel: (orgId: string, invoiceId: string, reason: string) =>
      request<Invoice>(`/organizations/${orgId}/invoices/${invoiceId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),

    duplicate: (orgId: string, invoiceId: string) =>
      request<Invoice>(`/organizations/${orgId}/invoices/${invoiceId}/duplicate`, {
        method: "POST",
      }),

    delete: (orgId: string, invoiceId: string) =>
      request<void>(`/organizations/${orgId}/invoices/${invoiceId}`, {
        method: "DELETE",
      }),

    downloadPdf: async (orgId: string, invoiceId: string, filename?: string) => {
      const url = `${API_BASE_URL}/api/v1/organizations/${orgId}/invoices/${invoiceId}/pdf`;
      const token = getStoredToken();
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error("Failed to download invoice PDF");
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename || `invoice-${invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    },
  },

  payments: {
    list: (
      orgId: string,
      params?: {
        invoice_id?: string;
        status?: string;
        payment_method?: string;
        skip?: number;
        limit?: number;
      }
    ) => {
      const q = new URLSearchParams();
      if (params?.invoice_id) q.set("invoice_id", params.invoice_id);
      if (params?.status) q.set("status", params.status);
      if (params?.payment_method) q.set("payment_method", params.payment_method);
      if (params?.skip !== undefined) q.set("skip", params.skip.toString());
      if (params?.limit !== undefined) q.set("limit", params.limit.toString());
      const qs = q.toString() ? `?${q.toString()}` : "";
      return request<PaymentListResponse>(`/organizations/${orgId}/payments${qs}`);
    },

    get: (orgId: string, paymentId: string) =>
      request<Payment>(`/organizations/${orgId}/payments/${paymentId}`),

    create: (orgId: string, body: PaymentCreate) =>
      request<Payment>(`/organizations/${orgId}/payments`, {
        method: "POST",
        body: JSON.stringify(body),
      }),

    reverse: (orgId: string, paymentId: string, reason: string) =>
      request<Payment>(`/organizations/${orgId}/payments/${paymentId}/reverse`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),

    getForInvoice: (orgId: string, invoiceId: string) =>
      request<PaymentListResponse>(`/organizations/${orgId}/invoices/${invoiceId}/payments`),
  },

  receivables: {
    get: (
      orgId: string,
      params?: {
        status?: string;
        client_id?: string;
        search?: string;
        start_date?: string;
        end_date?: string;
        aging_bracket?: string;
        skip?: number;
        limit?: number;
      }
    ) => {
      const q = new URLSearchParams();
      if (params?.status) q.set("status", params.status);
      if (params?.client_id) q.set("client_id", params.client_id);
      if (params?.search) q.set("search", params.search);
      if (params?.start_date) q.set("start_date", params.start_date);
      if (params?.end_date) q.set("end_date", params.end_date);
      if (params?.aging_bracket) q.set("aging_bracket", params.aging_bracket);
      if (params?.skip !== undefined) q.set("skip", params.skip.toString());
      if (params?.limit !== undefined) q.set("limit", params.limit.toString());
      const qs = q.toString() ? `?${q.toString()}` : "";
      return request<ReceivablesSummaryResponse>(`/organizations/${orgId}/receivables${qs}`);
    },
  },

  emails: {
    sendInvoice: (
      orgId: string,
      invoiceId: string,
      body?: {
        recipient_email?: string;
        subject?: string;
        message?: string;
        attach_pdf?: boolean;
      }
    ) =>
      request<EmailLog>(`/organizations/${orgId}/invoices/${invoiceId}/send-email`, {
        method: "POST",
        body: JSON.stringify(body || {}),
      }),

    sendReminder: (
      orgId: string,
      invoiceId: string,
      body?: {
        message?: string;
      }
    ) =>
      request<EmailLog>(`/organizations/${orgId}/invoices/${invoiceId}/remind`, {
        method: "POST",
        body: JSON.stringify(body || {}),
      }),

    listLogs: (
      orgId: string,
      params?: {
        invoice_id?: string;
        client_id?: string;
        status?: string;
        notification_type?: string;
        skip?: number;
        limit?: number;
      }
    ) => {
      const q = new URLSearchParams();
      if (params?.invoice_id) q.set("invoice_id", params.invoice_id);
      if (params?.client_id) q.set("client_id", params.client_id);
      if (params?.status) q.set("status", params.status);
      if (params?.notification_type) q.set("notification_type", params.notification_type);
      if (params?.skip !== undefined) q.set("skip", params.skip.toString());
      if (params?.limit !== undefined) q.set("limit", params.limit.toString());
      const qs = q.toString() ? `?${q.toString()}` : "";
      return request<EmailLogListResponse>(`/organizations/${orgId}/email-logs${qs}`);
    },

    processReminders: (orgId: string) =>
      request<any>(`/organizations/${orgId}/reminders/process`, {
        method: "POST",
      }),
  },

  analytics: {
    getSummary: (
      orgId: string,
      params?: { start_date?: string; end_date?: string; preset?: string; currency?: string }
    ) => {
      const q = new URLSearchParams();
      if (params?.start_date) q.set("start_date", params.start_date);
      if (params?.end_date) q.set("end_date", params.end_date);
      if (params?.preset) q.set("preset", params.preset);
      if (params?.currency) q.set("currency", params.currency);
      const qs = q.toString() ? `?${q.toString()}` : "";
      return request<AnalyticsSummaryResponse>(`/organizations/${orgId}/analytics/summary${qs}`);
    },

    getRevenueTrends: (orgId: string, params?: { months_count?: number; currency?: string }) => {
      const q = new URLSearchParams();
      if (params?.months_count) q.set("months_count", String(params.months_count));
      if (params?.currency) q.set("currency", params.currency);
      const qs = q.toString() ? `?${q.toString()}` : "";
      return request<RevenueTrendsResponse>(`/organizations/${orgId}/analytics/revenue-trends${qs}`);
    },

    getAging: (orgId: string, params?: { currency?: string }) => {
      const q = new URLSearchParams();
      if (params?.currency) q.set("currency", params.currency);
      const qs = q.toString() ? `?${q.toString()}` : "";
      return request<AgingAnalyticsResponse>(`/organizations/${orgId}/analytics/aging${qs}`);
    },

    getStatusDistribution: (orgId: string, params?: { currency?: string }) => {
      const q = new URLSearchParams();
      if (params?.currency) q.set("currency", params.currency);
      const qs = q.toString() ? `?${q.toString()}` : "";
      return request<StatusDistributionResponse>(`/organizations/${orgId}/analytics/status-distribution${qs}`);
    },

    getClients: (
      orgId: string,
      params?: {
        search?: string;
        sort_by?: string;
        descending?: boolean;
        skip?: number;
        limit?: number;
        currency?: string;
      }
    ) => {
      const q = new URLSearchParams();
      if (params?.search) q.set("search", params.search);
      if (params?.sort_by) q.set("sort_by", params.sort_by);
      if (params?.descending !== undefined) q.set("descending", String(params.descending));
      if (params?.skip !== undefined) q.set("skip", String(params.skip));
      if (params?.limit !== undefined) q.set("limit", String(params.limit));
      if (params?.currency) q.set("currency", params.currency);
      const qs = q.toString() ? `?${q.toString()}` : "";
      return request<ClientPerformanceResponse>(`/organizations/${orgId}/analytics/clients${qs}`);
    },

    downloadCsv: async (orgId: string, exportType: string, statusFilter?: string, filename?: string) => {
      const q = new URLSearchParams();
      if (statusFilter) q.set("status", statusFilter);
      const qs = q.toString() ? `?${q.toString()}` : "";
      const url = `${API_BASE_URL}/api/v1/organizations/${orgId}/analytics/export/${exportType}${qs}`;
      const token = getStoredToken();
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error(`Failed to export ${exportType} CSV`);
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename || `${exportType}_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    },
  },

  ai: {
    getSummary: (orgId: string, params?: { start_date?: string; end_date?: string; currency?: string }) =>
      request<AISummaryResponse>(`/organizations/${orgId}/ai/summary`, {
        method: "POST",
        body: JSON.stringify(params || {}),
      }),

    draftReminder: (
      orgId: string,
      body: { invoice_id: string; tone?: "friendly" | "professional" | "firm"; custom_instructions?: string }
    ) =>
      request<AIDraftReminderResponse>(`/organizations/${orgId}/ai/draft-reminder`, {
        method: "POST",
        body: JSON.stringify(body),
      }),

    askQuery: (orgId: string, query: string) =>
      request<AINaturalQueryResponse>(`/organizations/${orgId}/ai/query`, {
        method: "POST",
        body: JSON.stringify({ query }),
      }),
  },

  health: () => request<{ status: string; app_name: string; database: string }>("/health"),
};
