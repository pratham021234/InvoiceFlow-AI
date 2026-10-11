"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api, Invoice, InvoiceStatus } from "@/lib/api";
import Navigation from "@/components/Navigation";
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Download,
  Copy,
  XCircle,
  RefreshCw,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle,
  FileText,
  DollarSign,
} from "lucide-react";

export default function InvoicesPage() {
  const { activeOrganization, loading: authLoading } = useAuth();
  const router = useRouter();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [skip, setSkip] = useState(0);
  const limit = 10;

  // Modals / Actions
  const [cancelModalInvoice, setCancelModalInvoice] = useState<Invoice | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!activeOrganization) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.invoices.list(activeOrganization.id, {
        skip,
        limit,
        status: statusFilter || undefined,
        search: search.trim() || undefined,
      });
      setInvoices(res.items);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message || "Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganization, skip, limit, statusFilter, search]);

  useEffect(() => {
    if (!authLoading && !activeOrganization) {
      router.push("/dashboard");
    } else if (activeOrganization) {
      fetchInvoices();
    }
  }, [authLoading, activeOrganization, fetchInvoices, router]);

  const handleDownloadPdf = async (invoice: Invoice) => {
    if (!activeOrganization) return;
    setActionLoadingId(invoice.id);
    try {
      await api.invoices.downloadPdf(
        activeOrganization.id,
        invoice.id,
        `${invoice.invoice_number || "invoice"}.pdf`
      );
    } catch (err: any) {
      alert(err.message || "PDF download failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDuplicate = async (invoice: Invoice) => {
    if (!activeOrganization) return;
    setActionLoadingId(invoice.id);
    try {
      const duplicated = await api.invoices.duplicate(activeOrganization.id, invoice.id);
      router.push(`/invoices/${duplicated.id}`);
    } catch (err: any) {
      alert(err.message || "Duplicate failed");
      setActionLoadingId(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!activeOrganization || !cancelModalInvoice) return;
    if (!cancelReason.trim()) {
      alert("Please enter a valid cancellation reason.");
      return;
    }
    setCancelling(true);
    try {
      await api.invoices.cancel(activeOrganization.id, cancelModalInvoice.id, cancelReason.trim());
      setCancelModalInvoice(null);
      setCancelReason("");
      fetchInvoices();
    } catch (err: any) {
      alert(err.message || "Failed to cancel invoice.");
    } finally {
      setCancelling(false);
    }
  };

  // Metrics
  const totalBilled = invoices.reduce((acc, inv) => acc + Number(inv.total_amount), 0);
  const totalOutstanding = invoices.reduce((acc, inv) => acc + Number(inv.balance_due), 0);
  const overdueCount = invoices.filter((inv) => inv.effective_status === "overdue").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Receipt className="w-8 h-8 text-indigo-400" />
              Invoices
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Create, track, issue, and generate downloadable PDFs for client billings.
            </p>
          </div>
          <Link
            href="/invoices/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Create Invoice
          </Link>
        </div>

        {/* Financial Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Total Outstanding
            </div>
            <div className="text-2xl font-extrabold text-amber-400">
              ${totalOutstanding.toFixed(2)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Across active invoices</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Overdue Count
            </div>
            <div className={`text-2xl font-extrabold ${overdueCount > 0 ? "text-rose-400" : "text-slate-300"}`}>
              {overdueCount}
            </div>
            <div className="text-xs text-slate-500 mt-1">Past due with balance</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Current Page Volume
            </div>
            <div className="text-2xl font-extrabold text-white">
              ${totalBilled.toFixed(2)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Invoiced amount</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Total Invoices
            </div>
            <div className="text-2xl font-extrabold text-indigo-400">{total}</div>
            <div className="text-xs text-slate-500 mt-1">Recorded in organization</div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search by invoice number or client name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSkip(0);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setSkip(0);
              }}
              className="bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <button
              onClick={() => fetchInvoices()}
              title="Refresh"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Invoice #</th>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Issue Date</th>
                  <th className="px-6 py-4">Due Date</th>
                  <th className="px-6 py-4 text-right">Total</th>
                  <th className="px-6 py-4 text-right">Balance Due</th>
                  <th className="px-6 py-4 text-center">Effective Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-normal">
                {loading && invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                      Loading invoices...
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center text-slate-400">
                      <Receipt className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-base font-semibold text-slate-200">No invoices found</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        {search || statusFilter
                          ? "Try clearing filters or search terms."
                          : "Create your first professional invoice to start collecting revenue."}
                      </p>
                      {!search && !statusFilter && (
                        <Link
                          href="/invoices/new"
                          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          New Invoice
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-6 py-4">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="font-bold text-white hover:text-indigo-400 transition"
                        >
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        {inv.client ? (
                          <Link
                            href={`/clients/${inv.client.id}`}
                            className="font-medium text-slate-200 hover:text-indigo-400 transition"
                          >
                            {inv.client.name}
                          </Link>
                        ) : (
                          <span className="text-slate-500 italic">Unknown Client</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">{inv.issue_date}</td>
                      <td className="px-6 py-4 text-xs text-slate-400">{inv.due_date}</td>
                      <td className="px-6 py-4 text-right font-medium text-white">
                        ${Number(inv.total_amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold">
                        <span
                          className={
                            Number(inv.balance_due) > 0 ? "text-amber-400" : "text-emerald-400"
                          }
                        >
                          ${Number(inv.balance_due).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                            inv.effective_status === "paid"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : inv.effective_status === "overdue"
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : inv.effective_status === "partially_paid"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : inv.effective_status === "issued"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : inv.effective_status === "cancelled"
                              ? "bg-slate-800 text-slate-400 border border-slate-700"
                              : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          }`}
                        >
                          {inv.effective_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/invoices/${inv.id}`}
                            title="View Invoice"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {/* PDF Download */}
                          <button
                            onClick={() => handleDownloadPdf(inv)}
                            title="Download PDF"
                            disabled={actionLoadingId === inv.id}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-indigo-400 disabled:opacity-50 transition"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Edit only if Draft */}
                          {inv.status === "draft" && (
                            <Link
                              href={`/invoices/${inv.id}/edit`}
                              title="Edit Draft"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Link>
                          )}

                          {/* Duplicate */}
                          <button
                            onClick={() => handleDuplicate(inv)}
                            title="Duplicate as new Draft"
                            disabled={actionLoadingId === inv.id}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          {/* Cancel if issued or overdue */}
                          {inv.status !== "draft" && inv.status !== "cancelled" && (
                            <button
                              onClick={() => {
                                setCancelModalInvoice(inv);
                                setCancelReason("");
                              }}
                              title="Cancel Invoice"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-500 hover:text-rose-400 transition"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="px-6 py-4 bg-slate-850 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div>
                Showing {skip + 1} to {Math.min(skip + limit, total)} of {total} invoices
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={skip === 0}
                  onClick={() => setSkip(Math.max(0, skip - limit))}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-white font-medium transition"
                >
                  Previous
                </button>
                <button
                  disabled={skip + limit >= total}
                  onClick={() => setSkip(skip + limit)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-white font-medium transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cancellation Modal */}
        {cancelModalInvoice && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 text-rose-400">
                <XCircle className="w-5 h-5" />
                Cancel Invoice {cancelModalInvoice.invoice_number}
              </h3>
              <p className="text-sm text-slate-400">
                Cancelling an invoice records an irreversible audit trail and changes its status.
                Please state the reason for cancellation:
              </p>
              <textarea
                rows={3}
                required
                placeholder="e.g. Client requested revisions, invoice voided by mutual agreement..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setCancelModalInvoice(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
                >
                  Close
                </button>
                <button
                  onClick={handleConfirmCancel}
                  disabled={cancelling || !cancelReason.trim()}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-sm font-semibold transition"
                >
                  {cancelling ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
