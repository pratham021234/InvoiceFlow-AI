"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navigation from "@/components/Navigation";
import { api, ReceivablesSummaryResponse, Payment, EmailLog } from "@/lib/api";
import {
  DollarSign,
  FileCheck,
  Clock,
  AlertTriangle,
  Building2,
  Settings,
  PlusCircle,
  TrendingUp,
  ShieldCheck,
  Loader2,
  CreditCard,
  Mail,
  Send,
  ArrowUpRight,
  Receipt,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { user, activeOrganization, organizations, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  const [receivables, setReceivables] = useState<ReceivablesSummaryResponse | null>(null);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [recentEmails, setRecentEmails] = useState<EmailLog[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  const loadDashboardData = async () => {
    if (!activeOrganization) return;
    setLoadingMetrics(true);
    try {
      const [recData, payData, emailData] = await Promise.all([
        api.receivables.get(activeOrganization.id, { limit: 6 }),
        api.payments.list(activeOrganization.id, { limit: 5 }),
        api.emails.listLogs(activeOrganization.id, { limit: 5 }),
      ]);
      setReceivables(recData);
      setRecentPayments(payData.items);
      setRecentEmails(emailData.items);
    } catch (err) {
      console.error("Dashboard metric load error:", err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    if (activeOrganization) {
      loadDashboardData();
    }
  }, [activeOrganization]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm">Loading InvoiceFlow AI workspace...</p>
      </div>
    );
  }

  const currency = activeOrganization?.currency || "USD";

  // Partially paid count
  const partiallyPaidCount = receivables?.invoices.filter((i) => i.status === "partially_paid").length || 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Workspace Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Tenant Isolated: {activeOrganization?.name || "Active Workspace"}
                </span>
                {activeOrganization?.user_role && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                    Role: {activeOrganization.user_role}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Welcome back, {user.full_name}
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Workspace Currency: <span className="text-slate-200 font-medium">{currency}</span> • Invoice Prefix: <span className="text-slate-200 font-medium">{activeOrganization?.invoice_prefix || "INV"}</span> • Next Number: <span className="text-slate-200 font-medium">{activeOrganization?.next_invoice_number || "1001"}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/receivables"
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-medium transition-colors"
              >
                <Clock className="w-4 h-4" />
                <span>Receivables</span>
              </Link>
              <Link
                href="/payments"
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                <span>Payments</span>
              </Link>
              <Link
                href="/invoices/new"
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors shadow-lg shadow-indigo-600/20"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Invoice</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Real KPI Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Payments Collected */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Payments Collected</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                {currency} {receivables ? Number(receivables.total_collected).toFixed(2) : "0.00"}
              </div>
              <div className="flex items-center text-xs text-slate-400 mt-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                <span>Net verified settlements</span>
              </div>
            </div>
          </div>

          {/* Outstanding Receivables */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Outstanding Balance</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-amber-400 font-mono">
                {currency} {receivables ? Number(receivables.total_receivables).toFixed(2) : "0.00"}
              </div>
              <div className="flex items-center text-xs text-slate-400 mt-1">
                <span>{receivables?.total_open_invoices || 0} active open invoices</span>
              </div>
            </div>
          </div>

          {/* Overdue Receivables */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Overdue Balance</span>
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-rose-400 font-mono">
                {currency} {receivables ? Number(receivables.total_overdue).toFixed(2) : "0.00"}
              </div>
              <div className="flex items-center text-xs text-slate-400 mt-1">
                <span>{receivables?.total_overdue_invoices || 0} invoices past due</span>
              </div>
            </div>
          </div>

          {/* Partially Paid & Invoiced */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Partially Paid Invoices</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <FileCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-indigo-300">
                {partiallyPaidCount}
              </div>
              <div className="flex items-center text-xs text-slate-400 mt-1">
                <span>With partial installments</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Open Receivables & Upcoming Dues */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upcoming Due Dates & Overdue List */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">Upcoming & Overdue Invoices</h2>
              </div>
              <Link href="/receivables" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                View all receivables →
              </Link>
            </div>

            {loadingMetrics ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                Loading ledger...
              </div>
            ) : !receivables || receivables.invoices.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-xl">
                No outstanding or overdue invoices. All accounts settled.
              </div>
            ) : (
              <div className="space-y-3">
                {receivables.invoices.slice(0, 5).map((inv) => {
                  const isOverdue = inv.effective_status === "overdue";
                  return (
                    <div
                      key={inv.id}
                      className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between hover:bg-slate-800/70 transition-colors"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <Link href={`/invoices/${inv.id}`} className="font-mono font-semibold text-white text-sm hover:text-indigo-400 transition-colors">
                            {inv.invoice_number}
                          </Link>
                          {isOverdue && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              {inv.days_overdue}d overdue
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{inv.client_name} • Due {inv.due_date}</p>
                      </div>

                      <div className="text-right">
                        <div className={`font-mono font-bold text-sm ${isOverdue ? "text-rose-400" : "text-amber-400"}`}>
                          {inv.currency} {Number(inv.balance_due).toFixed(2)}
                        </div>
                        <span className="text-[10px] text-slate-400 capitalize">{inv.effective_status.replace("_", " ")}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recently Recorded Payments */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Recently Recorded Payments</h2>
              </div>
              <Link href="/payments" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                View payments ledger →
              </Link>
            </div>

            {loadingMetrics ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                Loading payments...
              </div>
            ) : recentPayments.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-xl">
                No recorded payments yet in this workspace.
              </div>
            ) : (
              <div className="space-y-3">
                {recentPayments.map((p) => {
                  const isRev = p.payment_status === "reversed";
                  return (
                    <div
                      key={p.id}
                      className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between hover:bg-slate-800/70 transition-colors"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-semibold text-white text-sm">
                            {p.payment_number || p.id.slice(0, 8)}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              isRev
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            }`}
                          >
                            {p.payment_status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {p.payment_date} • {p.payment_method.replace("_", " ")}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className={`font-mono font-bold text-sm ${isRev ? "line-through text-slate-500" : "text-emerald-400"}`}>
                          {p.currency} {Number(p.amount).toFixed(2)}
                        </div>
                        <Link
                          href={`/invoices/${p.invoice_id}`}
                          className="text-[10px] text-indigo-400 hover:underline"
                        >
                          Invoice Details →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Section: Recent Transactional Email & Reminder Activity */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Mail className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">Recent Reminders & Delivery Activity</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">Transactional SMTP Delivery</span>
          </div>

          {loadingMetrics ? (
            <div className="py-6 text-center text-slate-400 text-sm">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
              Loading logs...
            </div>
          ) : recentEmails.length === 0 ? (
            <div className="py-6 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-xl">
              No recent email notifications or reminders dispatched.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Recipient</th>
                    <th className="py-2.5 px-3">Delivery Status</th>
                    <th className="py-2.5 px-3">Provider ID / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {recentEmails.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3 text-slate-300 text-xs font-mono">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-xs capitalize text-slate-200">
                        {log.notification_type.replace("_", " ")}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-300 font-mono">{log.recipient_email}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${
                            log.delivery_status === "accepted_by_provider"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : log.delivery_status === "failed"
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          {log.delivery_status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs font-mono text-slate-400">
                        {log.provider_message_id || log.error_message || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Tenant Workspaces Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Your Workspaces & Tenant Memberships</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {organizations.map((org) => (
              <div
                key={org.id}
                className={`p-4 rounded-lg border transition-all ${
                  activeOrganization?.id === org.id
                    ? "bg-slate-800/90 border-indigo-500 shadow-md shadow-indigo-500/10"
                    : "bg-slate-800/40 border-slate-700/60 hover:bg-slate-800"
                }`}
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-white truncate">{org.name}</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                    {org.user_role}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Slug: {org.slug}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                  <span>Currency: {org.currency}</span>
                  <span>Timezone: {org.timezone}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
