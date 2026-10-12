"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Navigation from "@/components/Navigation";
import { api, ReceivablesSummaryResponse } from "@/lib/api";
import {
  Clock,
  AlertTriangle,
  DollarSign,
  Search,
  Send,
  CreditCard,
  ArrowUpRight,
  Loader2,
  CheckCircle2,
  CalendarDays,
  BellRing,
  Download,
} from "lucide-react";

export default function ReceivablesPage() {
  const { user, activeOrganization, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<ReceivablesSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [agingFilter, setAgingFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Reminder triggering state
  const [remindingInvoiceId, setRemindingInvoiceId] = useState<string | null>(null);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  const fetchReceivables = async () => {
    if (!activeOrganization) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.receivables.get(activeOrganization.id, {
        status: statusFilter || undefined,
        aging_bracket: agingFilter || undefined,
        search: searchTerm.trim() || undefined,
        limit: 100,
      });
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load receivables ledger.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeOrganization) {
      fetchReceivables();
    }
  }, [activeOrganization, statusFilter, agingFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReceivables();
  };

  const handleSendReminder = async (invoiceId: string) => {
    if (!activeOrganization) return;
    setRemindingInvoiceId(invoiceId);
    setReminderMessage(null);
    try {
      const res = await api.emails.sendReminder(activeOrganization.id, invoiceId);
      setReminderMessage(`Reminder accepted by provider (ID: ${res.provider_message_id || res.id.slice(0, 8)})`);
      await fetchReceivables();
    } catch (err: any) {
      setReminderMessage(`Error: ${err.message || "Could not deliver reminder."}`);
    } finally {
      setRemindingInvoiceId(null);
      setTimeout(() => setReminderMessage(null), 6000);
    }
  };

  const handleExportCsv = async () => {
    if (!activeOrganization) return;
    try {
      await api.analytics.downloadCsv(activeOrganization.id, "receivables");
    } catch (err: any) {
      alert(err.message || "Failed to export receivables CSV");
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm">Loading Accounts Receivable ledger...</p>
      </div>
    );
  }

  const currency = activeOrganization?.currency || "USD";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center space-x-2">
              <Clock className="w-6 h-6 text-amber-400" />
              <h1 className="text-2xl font-bold text-white tracking-tight">Accounts Receivable & Aging</h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Authoritative aging breakdown, overdue tracking, and automated reminder management.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportCsv}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              <span>Export CSV</span>
            </button>
            <Link
              href="/payments"
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium transition-colors"
            >
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>Payments Ledger</span>
            </Link>
          </div>
        </div>

        {/* Global Reminder Notification Toast */}
        {reminderMessage && (
          <div
            className={`mb-6 p-4 rounded-xl border text-sm font-medium flex items-center justify-between ${
              reminderMessage.startsWith("Error")
                ? "bg-rose-950/60 border-rose-800 text-rose-300"
                : "bg-emerald-950/60 border-emerald-800 text-emerald-300"
            }`}
          >
            <div className="flex items-center space-x-2">
              <BellRing className="w-4 h-4" />
              <span>{reminderMessage}</span>
            </div>
            <button onClick={() => setReminderMessage(null)} className="text-xs underline">
              Dismiss
            </button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Total Receivables</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-white">
                {currency} {data ? Number(data.total_receivables).toFixed(2) : "0.00"}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                <span>{data?.total_open_invoices || 0} open balance invoices</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Overdue Balance</span>
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-rose-400">
                {currency} {data ? Number(data.total_overdue).toFixed(2) : "0.00"}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                <span>{data?.total_overdue_invoices || 0} invoices past due date</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Total Collected</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-emerald-400">
                {currency} {data ? Number(data.total_collected).toFixed(2) : "0.00"}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                <span>Net valid payments</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Overdue Ratio</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <CalendarDays className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-indigo-300">
                {data && Number(data.total_receivables) > 0
                  ? `${Math.round((Number(data.total_overdue) / Number(data.total_receivables)) * 100)}%`
                  : "0%"}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                <span>Of outstanding portfolio</span>
              </div>
            </div>
          </div>
        </div>

        {/* Aging Buckets Cards */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Aging Buckets Breakdown
            </h2>
            <span className="text-xs text-slate-500">Based on standard GAAP aging categories</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {data?.brackets.map((b) => {
              const isSelected = agingFilter === b.bracket;
              return (
                <button
                  key={b.bracket}
                  onClick={() => setAgingFilter(isSelected ? "" : b.bracket)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "bg-slate-800 border-indigo-500 shadow-lg shadow-indigo-500/10"
                      : "bg-slate-900 border-slate-800 hover:bg-slate-800/60"
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-300">{b.label}</div>
                  <div className="text-lg font-bold text-white mt-1">
                    {currency} {Number(b.total_balance).toFixed(2)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {b.invoice_count} invoice{b.invoice_count === 1 ? "" : "s"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 flex flex-wrap items-center gap-4">
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[240px]">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search invoice number or client name..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </form>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="overdue">Overdue Only</option>
              <option value="due_soon">Due Soon (7 Days)</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Settled / Paid</option>
            </select>
          </div>

          {(statusFilter || agingFilter || searchTerm) && (
            <button
              onClick={() => {
                setStatusFilter("");
                setAgingFilter("");
                setSearchTerm("");
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline"
            >
              Clear filters
            </button>
          )}

          <div className="ml-auto text-xs text-slate-400 font-mono">
            Showing <span className="text-white font-semibold">{data?.invoices.length || 0}</span> invoices
          </div>
        </div>

        {/* Receivables Table */}
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
            <p>Computing receivables balances...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-950/40 border border-rose-800/80 rounded-xl p-6 text-center text-rose-300">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-rose-400" />
            <p className="font-medium">{error}</p>
          </div>
        ) : !data || data.invoices.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-200">No matching receivables found</h3>
            <p className="text-sm mt-1 max-w-sm mx-auto text-slate-400">
              There are no open or overdue balances matching your current filter criteria.
            </p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Invoice #</th>
                    <th className="py-3.5 px-4">Client</th>
                    <th className="py-3.5 px-4">Due Date</th>
                    <th className="py-3.5 px-4 text-center">Overdue Days</th>
                    <th className="py-3.5 px-4 text-right">Total Amount</th>
                    <th className="py-3.5 px-4 text-right">Amount Paid</th>
                    <th className="py-3.5 px-4 text-right">Balance Due</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Last Reminder</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {data.invoices.map((inv) => {
                    const isOverdue = inv.effective_status === "overdue";
                    return (
                      <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-semibold text-white">
                          <Link href={`/invoices/${inv.id}`} className="hover:text-indigo-400 transition-colors">
                            {inv.invoice_number}
                          </Link>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 font-medium">
                          <Link href={`/clients/${inv.client_id}`} className="hover:text-indigo-400 transition-colors">
                            {inv.client_name}
                          </Link>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 font-mono text-xs">{inv.due_date}</td>
                        <td className="py-3.5 px-4 text-center">
                          {inv.days_overdue > 0 ? (
                            <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              {inv.days_overdue}d overdue
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">Current</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                          {inv.currency} {Number(inv.total_amount).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-emerald-400">
                          {inv.currency} {Number(inv.amount_paid).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold">
                          <span className={Number(inv.balance_due) > 0 ? (isOverdue ? "text-rose-400" : "text-amber-400") : "text-slate-500"}>
                            {inv.currency} {Number(inv.balance_due).toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-medium capitalize border ${
                              inv.status === "paid"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : isOverdue
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                : inv.status === "partially_paid"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                            }`}
                          >
                            {inv.effective_status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-400 font-mono">
                          {inv.latest_reminder_date ? new Date(inv.latest_reminder_date).toLocaleDateString() : "Never"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {Number(inv.balance_due) > 0 && (
                              <button
                                onClick={() => handleSendReminder(inv.id)}
                                disabled={remindingInvoiceId === inv.id}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-colors disabled:opacity-50"
                                title="Send transactional payment reminder"
                              >
                                {remindingInvoiceId === inv.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Send className="w-3 h-3" />
                                )}
                                <span>Remind</span>
                              </button>
                            )}
                            <Link
                              href={`/invoices/${inv.id}`}
                              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                              title="View Invoice"
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
