"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Navigation from "@/components/Navigation";
import { api, Payment } from "@/lib/api";
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Loader2,
  Receipt,
  ArrowUpRight,
  ShieldAlert,
  Download,
} from "lucide-react";

export default function PaymentsPage() {
  const { user, activeOrganization, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [methodFilter, setMethodFilter] = useState<string>("");
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reversal Modal State
  const [reversingPayment, setReversingPayment] = useState<Payment | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reversalSubmitting, setReversalSubmitting] = useState(false);
  const [reversalError, setReversalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  const loadPayments = async () => {
    if (!activeOrganization) return;
    setLoadingPayments(true);
    setError(null);
    try {
      const res = await api.payments.list(activeOrganization.id, {
        status: statusFilter || undefined,
        payment_method: methodFilter || undefined,
        limit: 50,
      });
      setPayments(res.items);
      setTotalCount(res.total);
    } catch (err: any) {
      setError(err.message || "Failed to load payment transactions.");
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    if (activeOrganization) {
      loadPayments();
    }
  }, [activeOrganization, statusFilter, methodFilter]);

  const handleReverseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrganization || !reversingPayment) return;
    if (!reversalReason.trim() || reversalReason.trim().length < 3) {
      setReversalError("A meaningful audit reason (at least 3 characters) is required.");
      return;
    }

    setReversalSubmitting(true);
    setReversalError(null);
    try {
      await api.payments.reverse(activeOrganization.id, reversingPayment.id, reversalReason.trim());
      setReversingPayment(null);
      setReversalReason("");
      await loadPayments();
    } catch (err: any) {
      setReversalError(err.message || "Failed to reverse payment transaction.");
    } finally {
      setReversalSubmitting(false);
    }
  };

  const handleExportCsv = async () => {
    if (!activeOrganization) return;
    try {
      await api.analytics.downloadCsv(activeOrganization.id, "payments", statusFilter || undefined);
    } catch (err: any) {
      alert(err.message || "Failed to export payments CSV");
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm">Loading workspace payments...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center space-x-2">
              <CreditCard className="w-6 h-6 text-indigo-400" />
              <h1 className="text-2xl font-bold text-white tracking-tight">Payments & Transactions</h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Audit trail of all recorded client settlements and accounting reversals.
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
              href="/receivables"
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 text-sm font-medium transition-colors"
            >
              <Receipt className="w-4 h-4" />
              <span>Accounts Receivable</span>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="reversed">Reversed</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Method:</span>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Methods</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="credit_card">Credit Card</option>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="online_gateway">Online Gateway</option>
            </select>
          </div>

          <div className="ml-auto text-xs text-slate-400 font-mono">
            Total records: <span className="text-white font-semibold">{totalCount}</span>
          </div>
        </div>

        {/* Table / Content */}
        {loadingPayments ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
            <p>Loading payments ledger...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-950/40 border border-rose-800/80 rounded-xl p-6 text-center text-rose-300">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-rose-400" />
            <p className="font-medium">{error}</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            <CreditCard className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-200">No payment transactions found</h3>
            <p className="text-sm mt-1 max-w-sm mx-auto text-slate-400">
              Payments are recorded against issued invoices. Open any eligible invoice to record a client payment.
            </p>
            <div className="mt-4">
              <Link
                href="/invoices"
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
              >
                <span>View Invoices</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Payment #</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Method</th>
                    <th className="py-3.5 px-4">Source & Verification</th>
                    <th className="py-3.5 px-4 text-right">Amount</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Reference</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {payments.map((p) => {
                    const isReversed = p.payment_status === "reversed";
                    return (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-200">
                          {p.payment_number || p.id.slice(0, 8)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">{p.payment_date}</td>
                        <td className="py-3.5 px-4 text-slate-300 capitalize">
                          {p.payment_method.replace("_", " ")}
                        </td>
                        <td className="py-3.5 px-4">
                          {p.is_manual ? (
                            <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              Manually Recorded
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              Gateway Verified
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold">
                          <span className={isReversed ? "line-through text-slate-500" : "text-emerald-400"}>
                            {p.currency} {Number(p.amount).toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {p.payment_status === "completed" && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              Completed
                            </span>
                          )}
                          {p.payment_status === "reversed" && (
                            <span
                              title={p.reversal_reason || "Reversed transaction"}
                              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium cursor-help"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Reversed
                            </span>
                          )}
                          {p.payment_status === "failed" && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                              <XCircle className="w-3 h-3" />
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-400 font-mono">
                          {p.reference || "—"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Link
                              href={`/invoices/${p.invoice_id}`}
                              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                              title="View Invoice"
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </Link>
                            {p.payment_status === "completed" && (
                              <button
                                onClick={() => {
                                  setReversingPayment(p);
                                  setReversalReason("");
                                  setReversalError(null);
                                }}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors"
                                title="Reverse this payment with audit reason"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Reverse</span>
                              </button>
                            )}
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

        {/* Reversal Confirmation Modal */}
        {reversingPayment && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
              <div className="flex items-center space-x-3 text-rose-400 mb-4">
                <ShieldAlert className="w-6 h-6" />
                <h3 className="text-lg font-bold text-white">Reverse Payment Transaction</h3>
              </div>

              <p className="text-sm text-slate-300 mb-4">
                You are about to reverse payment of{" "}
                <span className="font-semibold text-rose-400">
                  {reversingPayment.currency} {Number(reversingPayment.amount).toFixed(2)}
                </span>
                . In accordance with GAAP audit requirements, records are never deleted; this entry will be marked as reversed and invoice balances will be atomically recalculated.
              </p>

              {reversalError && (
                <div className="bg-rose-950/60 border border-rose-800 rounded-lg p-3 text-xs text-rose-300 mb-4">
                  {reversalError}
                </div>
              )}

              <form onSubmit={handleReverseSubmit}>
                <div className="mb-5">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Audit Reversal Reason <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={reversalReason}
                    onChange={(e) => setReversalReason(e.target.value)}
                    placeholder="e.g. Check returned for insufficient funds / duplicate charge correction"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setReversingPayment(null)}
                    disabled={reversalSubmitting}
                    className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reversalSubmitting}
                    className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center space-x-2 shadow-lg shadow-rose-600/20"
                  >
                    {reversalSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Confirm Reversal</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
