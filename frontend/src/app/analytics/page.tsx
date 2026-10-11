"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navigation from "@/components/Navigation";
import {
  api,
  AnalyticsSummaryResponse,
  RevenueTrendsResponse,
  AgingAnalyticsResponse,
  StatusDistributionResponse,
  ClientPerformanceResponse,
  AISummaryResponse,
  AIDraftReminderResponse,
  AINaturalQueryResponse,
} from "@/lib/api";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Download,
  Bot,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  Search,
  Filter,
  FileText,
  CreditCard,
  Building2,
  Send,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  HelpCircle,
  Percent,
  CalendarRange,
} from "lucide-react";

export default function AnalyticsPage() {
  const { activeOrganization, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  // Date filters
  const [preset, setPreset] = useState<string>("30d");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Analytics data state
  const [summary, setSummary] = useState<AnalyticsSummaryResponse | null>(null);
  const [trends, setTrends] = useState<RevenueTrendsResponse | null>(null);
  const [aging, setAging] = useState<AgingAnalyticsResponse | null>(null);
  const [distribution, setDistribution] = useState<StatusDistributionResponse | null>(null);
  const [clientPerf, setClientPerf] = useState<ClientPerformanceResponse | null>(null);
  const [clientSearch, setClientSearch] = useState<string>("");
  const [clientSortBy, setClientSortBy] = useState<string>("total_invoiced");
  const [clientPage, setClientPage] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportDropdownOpen, setExportDropdownOpen] = useState<boolean>(false);

  // AI Assistant Modal/Drawer state
  const [aiOpen, setAiOpen] = useState<boolean>(false);
  const [aiTab, setAiTab] = useState<"summary" | "query" | "draft">("summary");
  const [aiSummary, setAiSummary] = useState<AISummaryResponse | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState<boolean>(false);

  // AI Query state
  const [aiQuery, setAiQuery] = useState<string>("");
  const [aiQueryResponse, setAiQueryResponse] = useState<AINaturalQueryResponse | null>(null);
  const [aiQueryLoading, setAiQueryLoading] = useState<boolean>(false);

  // AI Draft Reminder state
  const [draftInvoiceId, setDraftInvoiceId] = useState<string>("");
  const [draftTone, setDraftTone] = useState<"friendly" | "professional" | "firm">("professional");
  const [draftInstructions, setDraftInstructions] = useState<string>("");
  const [draftResponse, setDraftResponse] = useState<AIDraftReminderResponse | null>(null);
  const [draftLoading, setDraftLoading] = useState<boolean>(false);
  const [copiedDraft, setCopiedDraft] = useState<boolean>(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  const fetchAnalytics = async () => {
    if (!activeOrganization) return;
    setLoading(true);
    try {
      const params = {
        preset: preset === "custom" ? undefined : preset,
        start_date: preset === "custom" && startDate ? startDate : undefined,
        end_date: preset === "custom" && endDate ? endDate : undefined,
      };

      const [summaryRes, trendsRes, agingRes, distRes, clientsRes] = await Promise.all([
        api.analytics.getSummary(activeOrganization.id, params),
        api.analytics.getRevenueTrends(activeOrganization.id, { months_count: 6 }),
        api.analytics.getAging(activeOrganization.id),
        api.analytics.getStatusDistribution(activeOrganization.id),
        api.analytics.getClients(activeOrganization.id, {
          search: clientSearch || undefined,
          sort_by: clientSortBy,
          skip: clientPage * 10,
          limit: 10,
        }),
      ]);

      setSummary(summaryRes);
      setTrends(trendsRes);
      setAging(agingRes);
      setDistribution(distRes);
      setClientPerf(clientsRes);
    } catch (err) {
      console.error("Failed to load analytics data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [activeOrganization, preset, startDate, endDate, clientSortBy, clientPage]);

  // Client search debounce / reload
  const handleClientSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setClientPage(0);
    fetchAnalytics();
  };

  // CSV Export handler
  const handleExport = async (type: string, label: string) => {
    if (!activeOrganization) return;
    setExporting(type);
    setExportDropdownOpen(false);
    try {
      await api.analytics.downloadCsv(activeOrganization.id, type);
    } catch (err: any) {
      alert(`Export failed: ${err.message || "Unknown error"}`);
    } finally {
      setExporting(null);
    }
  };

  // AI Summary trigger
  const handleGenerateAISummary = async () => {
    if (!activeOrganization) return;
    setAiSummaryLoading(true);
    try {
      const res = await api.ai.getSummary(activeOrganization.id, {
        start_date: preset === "custom" ? startDate : undefined,
        end_date: preset === "custom" ? endDate : undefined,
      });
      setAiSummary(res);
    } catch (err: any) {
      alert(`AI Summary failed: ${err.message || "Failed to generate summary"}`);
    } finally {
      setAiSummaryLoading(false);
    }
  };

  // AI Query trigger
  const handleExecuteAIQuery = async (queryText: string) => {
    if (!activeOrganization || !queryText.trim()) return;
    setAiQueryLoading(true);
    try {
      const res = await api.ai.askQuery(activeOrganization.id, queryText);
      setAiQueryResponse(res);
    } catch (err: any) {
      alert(`AI Query failed: ${err.message || "Failed to process question"}`);
    } finally {
      setAiQueryLoading(false);
    }
  };

  // AI Draft trigger
  const handleDraftReminder = async () => {
    if (!activeOrganization || !draftInvoiceId) {
      alert("Please enter an Invoice ID to draft a reminder for.");
      return;
    }
    setDraftLoading(true);
    setCopiedDraft(false);
    try {
      const res = await api.ai.draftReminder(activeOrganization.id, {
        invoice_id: draftInvoiceId,
        tone: draftTone,
        custom_instructions: draftInstructions || undefined,
      });
      setDraftResponse(res);
    } catch (err: any) {
      alert(`Draft failed: ${err.message || "Failed to generate reminder"}`);
    } finally {
      setDraftLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);
  };

  const formatMoney = (val: string | number | undefined, currency = "USD") => {
    const num = Number(val || 0);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format(num);
  };

  const formatPercent = (val: string | number | null | undefined) => {
    if (val === null || val === undefined) return "N/A";
    const num = Number(val);
    return `${num > 0 ? "+" : ""}${num.toFixed(1)}%`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navigation />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Header & Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
                  <span>Analytics & Financial Intelligence</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Phase 5 Production
                  </span>
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Real-time invoiced revenue, cash collection trends, overdue aging, and AI receivables assistant.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* AI Assistant Open Button */}
            <button
              onClick={() => {
                setAiOpen(true);
                if (!aiSummary) handleGenerateAISummary();
              }}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-sm shadow-lg shadow-indigo-600/25 transition-all transform hover:-translate-y-0.5"
            >
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>AI Receivables Assistant</span>
            </button>

            {/* CSV Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                disabled={Boolean(exporting)}
                className="flex items-center space-x-2 px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm font-medium transition-colors"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                ) : (
                  <Download className="w-4 h-4 text-indigo-400" />
                )}
                <span>Export CSV</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {exportDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-800 bg-slate-900/95 backdrop-blur-md shadow-2xl py-2 z-50">
                  <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Secure UTF-8 CSV Exports
                  </div>
                  {[
                    { type: "invoices", label: "Invoices Register" },
                    { type: "payments", label: "Payment Receipts" },
                    { type: "clients", label: "Client Performance" },
                    { type: "receivables", label: "Open Receivables" },
                    { type: "overdue", label: "Overdue Invoices" },
                    { type: "monthly_summary", label: "Monthly Financials" },
                  ].map((item) => (
                    <button
                      key={item.type}
                      onClick={() => handleExport(item.type, item.label)}
                      className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 hover:text-white flex items-center justify-between"
                    >
                      <span>{item.label}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  ))}
                  <div className="px-3 py-1 text-[11px] text-slate-400 border-t border-slate-800 mt-1">
                    Protected against formula injection (CWE-1236)
                  </div>
                </div>
              )}
            </div>

            {/* Refresh */}
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              title="Refresh Analytics"
              className="p-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-400 mr-2 flex items-center space-x-1">
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Reporting Period:</span>
            </span>
            {[
              { id: "30d", label: "Last 30 Days" },
              { id: "90d", label: "Last 90 Days" },
              { id: "current_month", label: "This Month" },
              { id: "last_month", label: "Last Month" },
              { id: "current_year", label: "Year to Date" },
              { id: "all", label: "All History" },
              { id: "custom", label: "Custom Range" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  preset === p.id
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30 font-semibold"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === "custom" && (
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-slate-500 text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        {/* Operational Disclaimer Note */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60 text-xs text-slate-400 flex items-start space-x-2">
          <HelpCircle className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
          <span>
            <strong className="text-slate-300">Operational Accounting Metrics:</strong> Invoiced and collected figures
            reflect valid billing records and completed cash receipts recorded in this organization. Invoice issuance is
            an operational invoicing metric and does not substitute for recognized accrual revenue on audited financial
            statements.
          </span>
        </div>

        {/* Key Financial Metrics (KPI Cards) */}
        {loading && !summary ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-32 rounded-2xl border border-slate-800 bg-slate-900/40 animate-pulse" />
            ))}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* 1. Invoiced Amount */}
            <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 relative overflow-hidden group hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Invoiced Total</span>
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-white tracking-tight">
                  {formatMoney(summary.invoiced_amount, summary.currency)}
                </div>
                <div className="mt-2 flex items-center space-x-2 text-xs">
                  {summary.mom_invoiced.percentage_change !== null ? (
                    <span
                      className={`inline-flex items-center space-x-0.5 font-semibold px-1.5 py-0.5 rounded ${
                        Number(summary.mom_invoiced.percentage_change) >= 0
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-rose-500/10 text-rose-400"
                      }`}
                    >
                      {Number(summary.mom_invoiced.percentage_change) >= 0 ? (
                        <TrendingUp className="w-3 h-3 mr-0.5" />
                      ) : (
                        <TrendingDown className="w-3 h-3 mr-0.5" />
                      )}
                      <span>{formatPercent(summary.mom_invoiced.percentage_change)}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">No prior baseline</span>
                  )}
                  <span className="text-slate-400">vs prior period</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800/60 text-xs text-slate-400 flex justify-between">
                <span>Active issued invoices</span>
                <span className="font-medium text-slate-300">{summary.active_invoices_count}</span>
              </div>
            </div>

            {/* 2. Payments Collected */}
            <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 relative overflow-hidden group hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Payments Collected</span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-emerald-400 tracking-tight">
                  {formatMoney(summary.payments_collected, summary.currency)}
                </div>
                <div className="mt-2 flex items-center space-x-2 text-xs">
                  {summary.mom_collected.percentage_change !== null ? (
                    <span
                      className={`inline-flex items-center space-x-0.5 font-semibold px-1.5 py-0.5 rounded ${
                        Number(summary.mom_collected.percentage_change) >= 0
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-rose-500/10 text-rose-400"
                      }`}
                    >
                      {Number(summary.mom_collected.percentage_change) >= 0 ? (
                        <TrendingUp className="w-3 h-3 mr-0.5" />
                      ) : (
                        <TrendingDown className="w-3 h-3 mr-0.5" />
                      )}
                      <span>{formatPercent(summary.mom_collected.percentage_change)}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">No prior baseline</span>
                  )}
                  <span className="text-slate-400">cash received</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800/60 text-xs text-slate-400 flex justify-between">
                <span>Fully settled invoices</span>
                <span className="font-medium text-slate-300">{summary.paid_invoices_count}</span>
              </div>
            </div>

            {/* 3. Outstanding Receivables */}
            <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 relative overflow-hidden group hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Outstanding Balance</span>
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-amber-300 tracking-tight">
                  {formatMoney(summary.outstanding_receivables, summary.currency)}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Partially paid: <strong className="text-slate-300">{formatMoney(summary.partially_paid_amount, summary.currency)}</strong>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800/60 text-xs text-slate-400 flex justify-between">
                <span>Excludes draft & cancelled</span>
                <span className="font-medium text-slate-300">Live balance</span>
              </div>
            </div>

            {/* 4. Overdue Receivables */}
            <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 relative overflow-hidden group hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overdue Balance</span>
                <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-rose-400 tracking-tight">
                  {formatMoney(summary.overdue_receivables, summary.currency)}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Overdue invoices: <strong className="text-rose-400 font-semibold">{summary.overdue_invoices_count}</strong>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800/60 text-xs text-slate-400 flex justify-between">
                <span>Action recommended</span>
                <button
                  onClick={() => router.push("/receivables?aging_bracket=1_7_days")}
                  className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center"
                >
                  <span>Inspect</span>
                  <ChevronRight className="w-3 h-3 ml-0.5" />
                </button>
              </div>
            </div>

            {/* 5. Collection Rate */}
            <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 relative overflow-hidden group hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Collection Efficiency</span>
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-white tracking-tight">
                  {Number(summary.collection_rate).toFixed(1)}%
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Collected vs issued all-time ratio
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800/60 text-xs text-slate-400 flex justify-between">
                <span>Healthy target: &gt;85%</span>
                <span className={Number(summary.collection_rate) >= 80 ? "text-emerald-400" : "text-amber-400"}>
                  {Number(summary.collection_rate) >= 80 ? "Optimal" : "Monitor"}
                </span>
              </div>
            </div>

            {/* 6. Average Collection Time */}
            <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 relative overflow-hidden group hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Days to Settle</span>
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-white tracking-tight">
                  {summary.average_collection_days !== null ? `${Number(summary.average_collection_days).toFixed(1)} days` : "N/A"}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Issuance to full settlement duration
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800/60 text-xs text-slate-400 flex justify-between">
                <span>Sufficient history</span>
                <span className="font-medium text-slate-300">
                  {summary.paid_invoices_count > 0 ? "Validated" : "Insufficient data"}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Revenue vs Collections Trend Chart Visualizer */}
        <div className="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>Monthly Invoiced vs Collected Cash</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Comparison of invoiced billing volume versus actual completed payments over the last 6 months.
              </p>
            </div>
            <div className="flex items-center space-x-4 text-xs">
              <div className="flex items-center space-x-1.5">
                <div className="w-3 h-3 rounded-sm bg-indigo-500" />
                <span className="text-slate-300">Invoiced</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                <span className="text-slate-300">Collected</span>
              </div>
            </div>
          </div>

          {trends && trends.items.length > 0 ? (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                {trends.items.map((m) => {
                  const invVal = Number(m.invoiced_amount);
                  const colVal = Number(m.collected_amount);
                  const maxVal = Math.max(
                    ...trends.items.map((x) => Math.max(Number(x.invoiced_amount), Number(x.collected_amount))),
                    1
                  );
                  const invHeight = Math.max(6, Math.min(100, (invVal / maxVal) * 100));
                  const colHeight = Math.max(6, Math.min(100, (colVal / maxVal) * 100));

                  return (
                    <div
                      key={m.period}
                      className="p-3 rounded-xl border border-slate-800/60 bg-slate-950/60 flex flex-col justify-between hover:border-slate-700 transition-all"
                    >
                      <div className="text-center pb-2 border-b border-slate-800/60">
                        <span className="text-xs font-semibold text-slate-300">{m.period_label}</span>
                      </div>

                      {/* Bar Visualization */}
                      <div className="h-32 flex items-end justify-center space-x-2 py-2">
                        {/* Invoiced Bar */}
                        <div className="flex flex-col items-center flex-1 h-full justify-end">
                          <div
                            style={{ height: `${invHeight}%` }}
                            className="w-full max-w-[20px] bg-indigo-500/80 hover:bg-indigo-400 rounded-t transition-all"
                            title={`Invoiced: ${formatMoney(m.invoiced_amount, trends.currency)} (${m.invoice_count} invoices)`}
                          />
                        </div>
                        {/* Collected Bar */}
                        <div className="flex flex-col items-center flex-1 h-full justify-end">
                          <div
                            style={{ height: `${colHeight}%` }}
                            className="w-full max-w-[20px] bg-emerald-500/80 hover:bg-emerald-400 rounded-t transition-all"
                            title={`Collected: ${formatMoney(m.collected_amount, trends.currency)} (${m.payment_count} payments)`}
                          />
                        </div>
                      </div>

                      <div className="text-[11px] pt-2 border-t border-slate-800/60 space-y-1">
                        <div className="flex justify-between text-slate-400">
                          <span>Inv:</span>
                          <span className="font-medium text-slate-200">{formatMoney(m.invoiced_amount, trends.currency)}</span>
                        </div>
                        <div className="flex justify-between text-emerald-400">
                          <span>Col:</span>
                          <span className="font-medium">{formatMoney(m.collected_amount, trends.currency)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end space-x-6 text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                <div>
                  6-Month Total Invoiced: <strong className="text-slate-200 font-semibold">{formatMoney(trends.total_invoiced, trends.currency)}</strong>
                </div>
                <div>
                  6-Month Total Collected: <strong className="text-emerald-400 font-semibold">{formatMoney(trends.total_collected, trends.currency)}</strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 text-sm">
              No historical invoicing or payment data available yet.
            </div>
          )}
        </div>

        {/* Two-Column Analytics: Overdue Aging Breakdown & Status Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Overdue Aging Analytics */}
          <div className="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <span>Overdue Aging Categories</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Breakdown by remaining balance (GAAP standard: due date vs current date).
                </p>
              </div>
              <button
                onClick={() => router.push("/receivables")}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center"
              >
                <span>Receivables Desk</span>
                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </button>
            </div>

            {aging ? (
              <div className="space-y-3.5 pt-2">
                {aging.brackets.map((b) => {
                  const pct = Number(b.percentage_of_receivables || 0);
                  const isCurrent = b.bracket === "current";
                  return (
                    <div key={b.bracket} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-slate-200">{b.label}</span>
                        <div className="space-x-3">
                          <span className="text-slate-400">{b.invoice_count} {b.invoice_count === 1 ? "invoice" : "invoices"}</span>
                          <span className={`font-bold ${isCurrent ? "text-slate-200" : "text-rose-400"}`}>
                            {formatMoney(b.total_balance, aging.currency)}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full ${
                            isCurrent
                              ? "bg-indigo-500"
                              : b.bracket === "1_7_days"
                              ? "bg-amber-500"
                              : b.bracket === "8_30_days"
                              ? "bg-orange-500"
                              : "bg-rose-500"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(pct, b.invoice_count > 0 ? 5 : 0))}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 text-right mt-1">
                        {pct.toFixed(1)}% of total open receivables
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-sm">No receivables aging recorded.</div>
            )}
          </div>

          {/* Invoice Status Distribution */}
          <div className="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <span>Invoice Status Distribution</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Lifecycle states across all recorded invoices.
                </p>
              </div>
              <button
                onClick={() => router.push("/invoices")}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center"
              >
                <span>View Invoices</span>
                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </button>
            </div>

            {distribution && distribution.items.length > 0 ? (
              <div className="space-y-3.5 pt-2">
                {distribution.items.map((item) => (
                  <div key={item.status} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-slate-200">{item.label}</span>
                      <div className="space-x-3">
                        <span className="text-slate-400">{item.count} invoices ({Number(item.percentage).toFixed(1)}%)</span>
                        <span className="font-bold text-slate-200">{formatMoney(item.total_amount, distribution.currency)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${
                          item.status === "paid"
                            ? "bg-emerald-500"
                            : item.status === "overdue"
                            ? "bg-rose-500"
                            : item.status === "partially_paid"
                            ? "bg-amber-500"
                            : item.status === "sent" || item.status === "issued"
                            ? "bg-indigo-500"
                            : "bg-slate-500"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(Number(item.percentage), item.count > 0 ? 5 : 0))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-sm">No invoices recorded yet.</div>
            )}
          </div>
        </div>

        {/* Client Performance Report Section */}
        <div className="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>Client Financial Performance</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Client-level revenue, collections, remaining balances, and settlement turnaround times without join duplicates.
              </p>
            </div>

            {/* Client Search & Sort Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <form onSubmit={handleClientSearch} className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search client name..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48 sm:w-56"
                />
              </form>

              <select
                value={clientSortBy}
                onChange={(e) => setClientSortBy(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="total_invoiced">Sort: Total Invoiced</option>
                <option value="total_collected">Sort: Total Collected</option>
                <option value="outstanding_balance">Sort: Highest Outstanding</option>
                <option value="overdue_balance">Sort: Highest Overdue</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800/80">
            <table className="min-w-full divide-y divide-slate-800/80 text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Client Name</th>
                  <th className="py-3 px-4">Invoiced Total</th>
                  <th className="py-3 px-4">Collected</th>
                  <th className="py-3 px-4">Outstanding</th>
                  <th className="py-3 px-4">Overdue</th>
                  <th className="py-3 px-4">Invoices</th>
                  <th className="py-3 px-4">Avg Days to Settle</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {clientPerf && clientPerf.items.length > 0 ? (
                  clientPerf.items.map((c) => (
                    <tr key={c.client_id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-medium text-white">
                        <div>{c.client_name}</div>
                        {c.email && <div className="text-[11px] text-slate-400">{c.email}</div>}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        {formatMoney(c.total_invoiced, c.currency)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-emerald-400">
                        {formatMoney(c.total_collected, c.currency)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-amber-300">
                        {formatMoney(c.outstanding_balance, c.currency)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-rose-400">
                        {Number(c.overdue_balance) > 0 ? formatMoney(c.overdue_balance, c.currency) : "—"}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <span>{c.invoice_count}</span>
                        {c.overdue_invoice_count > 0 && (
                          <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-rose-500/20 text-rose-300">
                            {c.overdue_invoice_count} overdue
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {c.average_settlement_days !== null ? `${Number(c.average_settlement_days).toFixed(1)} d` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => router.push(`/clients/${c.client_id}`)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                          CRM Profile
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No client records match the selected criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Receivables Assistant Drawer / Modal */}
        {aiOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end transition-opacity">
            <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">
              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                      <span>AI Receivables Assistant</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        Read-Only Security
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Authorized summaries, natural-language metrics, and tone-based reminders.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAiOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-800 bg-slate-950/40 text-xs font-medium">
                <button
                  onClick={() => setAiTab("summary")}
                  className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                    aiTab === "summary"
                      ? "border-violet-500 text-violet-400 font-semibold bg-violet-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Financial Summary
                </button>
                <button
                  onClick={() => setAiTab("query")}
                  className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                    aiTab === "query"
                      ? "border-violet-500 text-violet-400 font-semibold bg-violet-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Natural Q&A
                </button>
                <button
                  onClick={() => setAiTab("draft")}
                  className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                    aiTab === "draft"
                      ? "border-violet-500 text-violet-400 font-semibold bg-violet-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Draft Reminder
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* TAB 1: SUMMARY */}
                {aiTab === "summary" && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        Executive briefing computed directly from backend figures.
                      </span>
                      <button
                        onClick={handleGenerateAISummary}
                        disabled={aiSummaryLoading}
                        className="text-xs text-violet-400 hover:text-violet-300 font-medium flex items-center space-x-1"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${aiSummaryLoading ? "animate-spin" : ""}`} />
                        <span>Re-analyze</span>
                      </button>
                    </div>

                    {aiSummaryLoading ? (
                      <div className="py-16 text-center space-y-3">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-violet-400" />
                        <p className="text-xs text-slate-400">Analyzing authorized financial records...</p>
                      </div>
                    ) : aiSummary ? (
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-950/20 space-y-2">
                          <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">
                            Executive Narrative
                          </span>
                          <p className="text-sm text-slate-200 leading-relaxed">{aiSummary.summary}</p>
                        </div>

                        {aiSummary.key_insights.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                              Key Observations
                            </span>
                            <div className="space-y-1.5">
                              {aiSummary.key_insights.map((ins, idx) => (
                                <div key={idx} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/60 text-xs text-slate-300 flex items-start space-x-2">
                                  <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
                                  <span>{ins}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {aiSummary.recommended_actions.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                              Recommended Actions
                            </span>
                            <div className="space-y-1.5">
                              {aiSummary.recommended_actions.map((act, idx) => (
                                <div key={idx} className="p-3 rounded-lg bg-slate-950/60 border border-emerald-500/20 text-xs text-emerald-300 flex items-start space-x-2">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                                  <span>{act}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="pt-2 text-[11px] text-slate-500 flex justify-between border-t border-slate-800/60">
                          <span>Engine: {aiSummary.provider}</span>
                          <span>{aiSummary.is_mock ? "Deterministic Fallback" : "Live LLM Connected"}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* TAB 2: NATURAL QUERY */}
                {aiTab === "query" && (
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-2">
                        Ask a Read-Only Question About Your Receivables
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. How much have I collected this month?"
                          value={aiQuery}
                          onChange={(e) => setAiQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleExecuteAIQuery(aiQuery)}
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                        />
                        <button
                          onClick={() => handleExecuteAIQuery(aiQuery)}
                          disabled={aiQueryLoading || !aiQuery.trim()}
                          className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium text-xs transition-colors flex items-center space-x-1.5"
                        >
                          {aiQueryLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          <span>Ask</span>
                        </button>
                      </div>
                    </div>

                    {/* Quick Suggestion Chips */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-slate-400 font-medium">Quick Suggestions:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          "How much have I collected this month?",
                          "Which invoices are overdue?",
                          "Which clients have the largest outstanding balances?",
                          "How do collections compare with last month?",
                        ].map((q) => (
                          <button
                            key={q}
                            onClick={() => {
                              setAiQuery(q);
                              handleExecuteAIQuery(q);
                            }}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:border-violet-500 hover:text-white transition-colors"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Result */}
                    {aiQueryLoading ? (
                      <div className="py-12 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-violet-400" />
                        <p className="text-xs text-slate-400 mt-2">Evaluating validated financial intent...</p>
                      </div>
                    ) : aiQueryResponse ? (
                      <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-violet-400">Answer</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            Intent: {aiQueryResponse.intent}
                          </span>
                        </div>
                        <p className="text-sm text-slate-200 leading-relaxed">{aiQueryResponse.answer}</p>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* TAB 3: DRAFT REMINDER */}
                {aiTab === "draft" && (
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Invoice ID</label>
                      <input
                        type="text"
                        placeholder="Enter invoice UUID (or pick from Receivables table)"
                        value={draftInvoiceId}
                        onChange={(e) => setDraftInvoiceId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Tone</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["friendly", "professional", "firm"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setDraftTone(t)}
                            className={`py-2 text-xs rounded-xl border capitalize font-medium transition-all ${
                              draftTone === t
                                ? "border-violet-500 bg-violet-600/20 text-violet-300 font-semibold"
                                : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Custom Instructions (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Mention our upcoming milestone or provide payment portal link"
                        value={draftInstructions}
                        onChange={(e) => setDraftInstructions(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                      />
                    </div>

                    <button
                      onClick={handleDraftReminder}
                      disabled={draftLoading || !draftInvoiceId}
                      className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors flex items-center justify-center space-x-2"
                    >
                      {draftLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      <span>Generate Professional Draft</span>
                    </button>

                    {draftResponse && (
                      <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-300">
                            To: {draftResponse.recipient_email} ({draftResponse.client_name})
                          </span>
                          <button
                            onClick={() => copyToClipboard(`Subject: ${draftResponse.subject}\n\n${draftResponse.body}`)}
                            className="text-xs text-violet-400 hover:text-violet-300 flex items-center space-x-1"
                          >
                            {copiedDraft ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedDraft ? "Copied!" : "Copy Draft"}</span>
                          </button>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-0.5">Subject</label>
                          <input
                            type="text"
                            value={draftResponse.subject}
                            onChange={(e) => setDraftResponse({ ...draftResponse, subject: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-0.5">Body</label>
                          <textarea
                            rows={8}
                            value={draftResponse.body}
                            onChange={(e) => setDraftResponse({ ...draftResponse, body: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono leading-relaxed"
                          />
                        </div>
                        <div className="text-[11px] text-slate-400">
                          🛡️ <strong>Safety Guarantee:</strong> AI never sends emails autonomously. You have complete control to edit and copy this message.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
