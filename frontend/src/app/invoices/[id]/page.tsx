"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api, Invoice, Client } from "@/lib/api";
import Navigation from "@/components/Navigation";
import {
  ArrowLeft,
  Receipt,
  Download,
  Edit2,
  Copy,
  XCircle,
  Trash2,
  Send,
  Building,
  User,
  Calendar,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  FileText,
  DollarSign,
  Share2,
} from "lucide-react";

function InvoiceDetailContent() {
  const params = useParams();
  const invoiceId = params.id as string;

  const { activeOrganization, loading: authLoading } = useAuth();
  const router = useRouter();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const fetchInvoice = async () => {
    if (!activeOrganization) return;
    setLoading(true);
    setError(null);
    try {
      const inv = await api.invoices.get(activeOrganization.id, invoiceId);
      setInvoice(inv);
    } catch (err: any) {
      setError(err.message || "Failed to load invoice.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !activeOrganization) {
      router.push("/dashboard");
    } else if (activeOrganization) {
      fetchInvoice();
    }
  }, [authLoading, activeOrganization, invoiceId]);

  const handleDownloadPdf = async () => {
    if (!activeOrganization || !invoice) return;
    setActionLoading(true);
    try {
      await api.invoices.downloadPdf(
        activeOrganization.id,
        invoice.id,
        `${invoice.invoice_number || "invoice"}.pdf`
      );
    } catch (err: any) {
      alert(err.message || "PDF download failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleIssue = async () => {
    if (!activeOrganization || !invoice) return;
    if (!confirm("Issuing will assign an official, sequential invoice number. Continue?")) return;
    setActionLoading(true);
    try {
      await api.invoices.issue(activeOrganization.id, invoice.id);
      fetchInvoice();
    } catch (err: any) {
      alert(err.message || "Failed to issue invoice.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicate = async () => {
    if (!activeOrganization || !invoice) return;
    setActionLoading(true);
    try {
      const dup = await api.invoices.duplicate(activeOrganization.id, invoice.id);
      router.push(`/invoices/${dup.id}`);
    } catch (err: any) {
      alert(err.message || "Failed to duplicate invoice.");
      setActionLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!activeOrganization || !invoice) return;
    if (!cancelReason.trim()) {
      alert("Please enter a valid cancellation reason.");
      return;
    }
    setActionLoading(true);
    try {
      await api.invoices.cancel(activeOrganization.id, invoice.id, cancelReason.trim());
      setShowCancelModal(false);
      setCancelReason("");
      fetchInvoice();
    } catch (err: any) {
      alert(err.message || "Failed to cancel invoice.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!activeOrganization || !invoice) return;
    if (!confirm("Are you sure you want to permanently delete this draft invoice?")) return;
    setActionLoading(true);
    try {
      await api.invoices.delete(activeOrganization.id, invoice.id);
      router.push("/invoices");
    } catch (err: any) {
      alert(err.message || "Failed to delete draft.");
      setActionLoading(false);
    }
  };

  if (loading && !invoice) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-400" />
          Loading invoice details...
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <Navigation />
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">Invoice Not Found</h2>
            <p className="text-sm text-slate-400">{error || "This invoice does not exist or access was denied."}</p>
            <Link
              href="/invoices"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Invoices
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isDraft = invoice.status === "draft";
  const isCancelled = invoice.status === "cancelled";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navigation />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <Link
          href="/invoices"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invoices
        </Link>

        {/* Action Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
          <div className="flex items-center gap-3">
            <Receipt className="w-6 h-6 text-indigo-400" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white">{invoice.invoice_number}</span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                    invoice.effective_status === "paid"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : invoice.effective_status === "overdue"
                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      : invoice.effective_status === "partially_paid"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : invoice.effective_status === "issued"
                      ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      : invoice.effective_status === "cancelled"
                      ? "bg-slate-800 text-slate-400 border border-slate-700"
                      : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                  }`}
                >
                  {invoice.effective_status}
                </span>
              </div>
              <span className="text-xs text-slate-400">Created on {invoice.created_at.split("T")[0]}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Download PDF */}
            <button
              onClick={handleDownloadPdf}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>

            {/* Issue (if draft) */}
            {isDraft && (
              <button
                onClick={handleIssue}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                Issue Official Invoice
              </button>
            )}

            {/* Edit (if draft) */}
            {isDraft && (
              <Link
                href={`/invoices/${invoice.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit
              </Link>
            )}

            {/* Duplicate */}
            <button
              onClick={handleDuplicate}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5" />
              Duplicate
            </button>

            {/* Cancel (if issued or overdue) */}
            {!isDraft && !isCancelled && (
              <button
                onClick={() => {
                  setCancelReason("");
                  setShowCancelModal(true);
                }}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-rose-400 hover:text-rose-300 text-xs font-medium transition disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancel
              </button>
            )}

            {/* Delete (if draft) */}
            {isDraft && (
              <button
                onClick={handleDeleteDraft}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 border border-slate-700 text-rose-400 hover:text-rose-300 text-xs font-medium transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Cancellation Notice Banner */}
        {isCancelled && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3">
            <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
            <div>
              <div className="font-bold text-sm">This invoice has been cancelled.</div>
              {invoice.cancellation_reason && (
                <div className="text-xs text-rose-400 mt-1">Reason: {invoice.cancellation_reason}</div>
              )}
            </div>
          </div>
        )}

        {/* Document Sheet / Printable Preview Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl space-y-10">
          {/* Header & Meta */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-800 pb-8">
            <div>
              <div className="text-xs uppercase tracking-widest text-indigo-400 font-bold mb-1">
                Issued By
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                {activeOrganization?.name}
              </h2>
              <div className="text-xs text-slate-400 mt-2 space-y-0.5">
                {activeOrganization?.address && <p>{activeOrganization.address}</p>}
                {activeOrganization?.email && <p>Email: {activeOrganization.email}</p>}
                {activeOrganization?.tax_id && <p>Tax ID: {activeOrganization.tax_id}</p>}
                <p>Country: {activeOrganization?.country}</p>
              </div>
            </div>

            <div className="text-left sm:text-right space-y-1">
              <div className="text-3xl font-extrabold text-white tracking-tight">INVOICE</div>
              <div className="text-sm font-semibold text-indigo-400">{invoice.invoice_number}</div>
              <div className="text-xs text-slate-400 pt-2 space-y-0.5">
                <p>Issue Date: <span className="text-white font-medium">{invoice.issue_date}</span></p>
                <p>Due Date: <span className="text-white font-medium">{invoice.due_date}</span></p>
                {invoice.payment_terms && (
                  <p>Terms: <span className="text-slate-300">{invoice.payment_terms}</span></p>
                )}
              </div>
            </div>
          </div>

          {/* Billed To */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-850 p-5 rounded-2xl border border-slate-800/80">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">
                Billed To
              </div>
              {invoice.client ? (
                <div className="space-y-1">
                  <Link
                    href={`/clients/${invoice.client.id}`}
                    className="text-base font-bold text-white hover:text-indigo-400 transition"
                  >
                    {invoice.client.name}
                  </Link>
                  {invoice.client.contact_name && (
                    <p className="text-xs text-slate-300">Attn: {invoice.client.contact_name}</p>
                  )}
                  {invoice.client.email && (
                    <p className="text-xs text-slate-400">{invoice.client.email}</p>
                  )}
                  {invoice.client.billing_address && (
                    <p className="text-xs text-slate-400 whitespace-pre-line mt-1">
                      {invoice.client.billing_address}
                    </p>
                  )}
                  {invoice.client.tax_id && (
                    <p className="text-xs text-slate-500 mt-1">Tax ID: {invoice.client.tax_id}</p>
                  )}
                </div>
              ) : (
                <div className="text-slate-500 text-xs italic">Client information unavailable</div>
              )}
            </div>

            {/* Financial Overview Card */}
            <div className="bg-slate-850 p-5 rounded-2xl border border-slate-800/80 flex flex-col justify-between">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">
                Payment Status
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-slate-300">
                  <span>Total Invoiced:</span>
                  <span className="font-semibold text-white">
                    ${Number(invoice.total_amount).toFixed(2)} {invoice.currency}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-slate-300">
                  <span>Amount Paid:</span>
                  <span className="font-semibold text-emerald-400">
                    ${Number(invoice.amount_paid).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800">
                  <span>Balance Due:</span>
                  <span
                    className={
                      Number(invoice.balance_due) > 0 ? "text-amber-400 text-lg" : "text-emerald-400"
                    }
                  >
                    ${Number(invoice.balance_due).toFixed(2)} {invoice.currency}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-4">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Discount</th>
                  <th className="px-4 py-3 text-right">Tax Rate</th>
                  <th className="px-4 py-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {invoice.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/20">
                    <td className="px-4 py-3.5 font-medium text-white">{item.description}</td>
                    <td className="px-4 py-3.5 text-right text-slate-300">
                      {Number(item.quantity).toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-right text-slate-300">
                      ${Number(item.unit_price).toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-right text-slate-400">
                      {Number(item.discount_percent) > 0
                        ? `${Number(item.discount_percent).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-right text-slate-400">
                      {Number(item.tax_rate) > 0 ? `${Number(item.tax_rate).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-white">
                      ${Number(item.line_total).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-8 pt-6 border-t border-slate-800">
            {/* Notes & Payment Terms */}
            <div className="flex-1 space-y-4">
              {invoice.notes && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">
                    Notes & Instructions
                  </div>
                  <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed bg-slate-850 p-4 rounded-xl border border-slate-800">
                    {invoice.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Calculations Breakdown */}
            <div className="w-full sm:w-72 space-y-2 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Subtotal:</span>
                <span className="font-semibold text-white">
                  ${Number(invoice.subtotal).toFixed(2)}
                </span>
              </div>
              {Number(invoice.discount_amount) > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Total Discount:</span>
                  <span className="font-semibold">-${Number(invoice.discount_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-300">
                <span>Total Tax:</span>
                <span className="font-semibold text-white">
                  ${Number(invoice.tax_amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-white pt-3 border-t border-slate-800">
                <span>Total Amount:</span>
                <span className="text-indigo-400 text-lg">
                  ${Number(invoice.total_amount).toFixed(2)} {invoice.currency}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cancellation Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 text-rose-400">
                <XCircle className="w-5 h-5" />
                Cancel Invoice
              </h3>
              <p className="text-sm text-slate-400">
                Cancelling marks this invoice as void. This action cannot be reversed. Please state
                a reason:
              </p>
              <textarea
                rows={3}
                required
                placeholder="Reason for invoice cancellation..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
                >
                  Close
                </button>
                <button
                  onClick={handleConfirmCancel}
                  disabled={actionLoading || !cancelReason.trim()}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-sm font-semibold transition"
                >
                  {actionLoading ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function InvoiceDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center text-sm text-slate-400">
          Loading invoice...
        </div>
      }
    >
      <InvoiceDetailContent />
    </React.Suspense>
  );
}
