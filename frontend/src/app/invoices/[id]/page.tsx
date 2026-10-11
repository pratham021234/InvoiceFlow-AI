"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api, Invoice, Client, Payment, EmailLog } from "@/lib/api";
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
  CheckCircle2,
  FileText,
  DollarSign,
  Share2,
  CreditCard,
  RotateCcw,
  Mail,
  History,
  Clock,
  ShieldAlert,
  Loader2,
  BellRing,
} from "lucide-react";

function InvoiceDetailContent() {
  const params = useParams();
  const invoiceId = params.id as string;

  const { activeOrganization, loading: authLoading } = useAuth();
  const router = useRouter();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payments & Email Logs state
  const [payments, setPayments] = useState<Payment[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modal / Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Record Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Send Invoice Email Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailAttachPdf, setEmailAttachPdf] = useState(true);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailNotification, setEmailNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Reverse Payment Modal State
  const [reversingPayment, setReversingPayment] = useState<Payment | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reversalSubmitting, setReversalSubmitting] = useState(false);
  const [reversalError, setReversalError] = useState<string | null>(null);

  const fetchInvoice = async () => {
    if (!activeOrganization) return;
    setLoading(true);
    setError(null);
    try {
      const inv = await api.invoices.get(activeOrganization.id, invoiceId);
      setInvoice(inv);
      if (inv.client?.email) {
        setEmailRecipient(inv.client.email);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load invoice.");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!activeOrganization) return;
    setLoadingHistory(true);
    try {
      const [payRes, emailRes] = await Promise.all([
        api.payments.list(activeOrganization.id, { invoice_id: invoiceId }),
        api.emails.listLogs(activeOrganization.id, { invoice_id: invoiceId }),
      ]);
      setPayments(payRes.items);
      setEmailLogs(emailRes.items);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !activeOrganization) {
      router.push("/dashboard");
    } else if (activeOrganization) {
      fetchInvoice();
      fetchHistory();
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
      await fetchInvoice();
      await fetchHistory();
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
      await fetchInvoice();
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

  const openRecordPaymentModal = () => {
    if (!invoice) return;
    setPaymentAmount(Number(invoice.balance_due).toFixed(2));
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMethod("bank_transfer");
    setPaymentReference("");
    setPaymentNotes("");
    setPaymentConfirmed(false);
    setPaymentError(null);
    setShowPaymentModal(true);
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrganization || !invoice) return;

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setPaymentError("Payment amount must be greater than zero.");
      return;
    }
    if (amt > Number(invoice.balance_due)) {
      setPaymentError(
        `Amount of ${invoice.currency} ${amt.toFixed(2)} exceeds remaining balance due of ${invoice.currency} ${Number(invoice.balance_due).toFixed(2)}.`
      );
      return;
    }
    if (!paymentConfirmed) {
      setPaymentError("Please confirm before submitting this payment record.");
      return;
    }

    setPaymentSubmitting(true);
    setPaymentError(null);
    try {
      await api.payments.create(activeOrganization.id, {
        invoice_id: invoice.id,
        amount: amt,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference: paymentReference.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
        is_manual: true,
      });

      setShowPaymentModal(false);
      await fetchInvoice();
      await fetchHistory();
    } catch (err: any) {
      setPaymentError(err.message || "Failed to record payment.");
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleSendInvoiceEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrganization || !invoice) return;
    if (!emailRecipient.trim()) {
      setEmailNotification({ type: "error", text: "Recipient email address is required." });
      return;
    }

    setEmailSubmitting(true);
    try {
      const res = await api.emails.sendInvoice(activeOrganization.id, invoice.id, {
        recipient_email: emailRecipient.trim(),
        subject: emailSubject.trim() || undefined,
        message: emailMessage.trim() || undefined,
        attach_pdf: emailAttachPdf,
      });
      setShowEmailModal(false);
      setEmailNotification({
        type: "success",
        text: `Invoice email accepted by provider (Message ID: ${res.provider_message_id || res.id.slice(0, 8)}). Delivery recorded.`,
      });
      await fetchHistory();
    } catch (err: any) {
      setEmailNotification({
        type: "error",
        text: err.message || "Email delivery failed. Please verify SMTP credentials in settings.",
      });
    } finally {
      setEmailSubmitting(false);
      setTimeout(() => setEmailNotification(null), 8000);
    }
  };

  const handleSendReminder = async () => {
    if (!activeOrganization || !invoice) return;
    setActionLoading(true);
    try {
      const res = await api.emails.sendReminder(activeOrganization.id, invoice.id);
      setEmailNotification({
        type: "success",
        text: `Payment reminder accepted by provider (Message ID: ${res.provider_message_id || res.id.slice(0, 8)}).`,
      });
      await fetchHistory();
    } catch (err: any) {
      setEmailNotification({
        type: "error",
        text: err.message || "Failed to trigger payment reminder.",
      });
    } finally {
      setActionLoading(false);
      setTimeout(() => setEmailNotification(null), 8000);
    }
  };

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
      await fetchInvoice();
      await fetchHistory();
    } catch (err: any) {
      setReversalError(err.message || "Failed to reverse payment transaction.");
    } finally {
      setReversalSubmitting(false);
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
  const isPaid = invoice.status === "paid" || Number(invoice.balance_due) <= 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navigation />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/invoices"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Invoices
          </Link>
          <div className="flex items-center space-x-3 text-xs text-slate-400">
            <Link href="/receivables" className="hover:text-indigo-400 transition-colors">
              Receivables
            </Link>
            <span>•</span>
            <Link href="/payments" className="hover:text-indigo-400 transition-colors">
              All Payments
            </Link>
          </div>
        </div>

        {/* Global Email Notification Banner */}
        {emailNotification && (
          <div
            className={`p-4 rounded-xl border text-sm font-medium flex items-center justify-between ${
              emailNotification.type === "error"
                ? "bg-rose-950/60 border-rose-800 text-rose-300"
                : "bg-emerald-950/60 border-emerald-800 text-emerald-300"
            }`}
          >
            <div className="flex items-center space-x-2">
              <BellRing className="w-4 h-4" />
              <span>{emailNotification.text}</span>
            </div>
            <button onClick={() => setEmailNotification(null)} className="text-xs underline">
              Dismiss
            </button>
          </div>
        )}

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
                  {invoice.effective_status.replace("_", " ")}
                </span>
              </div>
              <span className="text-xs text-slate-400">Created on {invoice.created_at.split("T")[0]}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Record Payment (if eligible: not draft, not cancelled, balance > 0) */}
            {!isDraft && !isCancelled && !isPaid && (
              <button
                onClick={openRecordPaymentModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Record Payment
              </button>
            )}

            {/* Send via Email (if eligible: not draft, not cancelled) */}
            {!isDraft && !isCancelled && (
              <button
                onClick={() => {
                  setEmailSubject(`Invoice ${invoice.invoice_number} from ${activeOrganization?.name || "InvoiceFlow AI"}`);
                  setShowEmailModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition"
              >
                <Mail className="w-3.5 h-3.5" />
                Email Invoice
              </button>
            )}

            {/* Send Reminder (if not draft, not cancelled, and balance > 0) */}
            {!isDraft && !isCancelled && !isPaid && (
              <button
                onClick={handleSendReminder}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-semibold transition disabled:opacity-50"
                title="Send transactional payment reminder"
              >
                <Send className="w-3.5 h-3.5" />
                Send Reminder
              </button>
            )}

            {/* Download PDF */}
            <button
              onClick={handleDownloadPdf}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition disabled:opacity-50"
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
                {activeOrganization?.email && <p>{activeOrganization.email}</p>}
                {activeOrganization?.phone && <p>{activeOrganization.phone}</p>}
                {activeOrganization?.tax_id && (
                  <p className="font-mono text-slate-500">Tax ID: {activeOrganization.tax_id}</p>
                )}
              </div>
            </div>

            <div className="text-left sm:text-right space-y-1">
              <div className="text-3xl font-black text-white tracking-tight">INVOICE</div>
              <div className="text-sm font-mono font-semibold text-indigo-400">
                {invoice.invoice_number}
              </div>
              <div className="text-xs text-slate-400 pt-2 space-y-0.5 font-mono">
                <div>Issue Date: {invoice.issue_date}</div>
                <div>Due Date: {invoice.due_date}</div>
              </div>
            </div>
          </div>

          {/* Client & Bill-To Section */}
          <div className="border-b border-slate-800 pb-8">
            <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">
              Billed To
            </div>
            <div className="text-lg font-bold text-white">{invoice.client?.name || "Client"}</div>
            <div className="text-xs text-slate-400 mt-1 space-y-0.5">
              {invoice.client?.contact_name && <p>Attn: {invoice.client.contact_name}</p>}
              {invoice.client?.email && <p>{invoice.client.email}</p>}
              {invoice.client?.billing_address && <p>{invoice.client.billing_address}</p>}
              {invoice.client?.tax_id && (
                <p className="font-mono text-slate-500">Tax ID: {invoice.client.tax_id}</p>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  <th className="py-3 px-2">Description</th>
                  <th className="py-3 px-2 text-right">Qty</th>
                  <th className="py-3 px-2 text-right">Unit Price</th>
                  <th className="py-3 px-2 text-right">Discount</th>
                  <th className="py-3 px-2 text-right">Tax</th>
                  <th className="py-3 px-2 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {invoice.items.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-800/20">
                    <td className="py-3.5 px-2 text-white font-medium">{item.description}</td>
                    <td className="py-3.5 px-2 text-right text-slate-300 font-mono">
                      {Number(item.quantity)}
                    </td>
                    <td className="py-3.5 px-2 text-right text-slate-300 font-mono">
                      ${Number(item.unit_price).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-2 text-right text-slate-400 font-mono">
                      {Number(item.discount_percent) > 0 ? `${item.discount_percent}%` : "—"}
                    </td>
                    <td className="py-3.5 px-2 text-right text-slate-400 font-mono">
                      {Number(item.tax_rate) > 0 ? `${item.tax_rate}%` : "—"}
                    </td>
                    <td className="py-3.5 px-2 text-right text-white font-semibold font-mono">
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
            <div className="w-full sm:w-80 space-y-2.5 text-sm">
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
              <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800">
                <span>Total Invoiced:</span>
                <span className="font-mono text-white">
                  ${Number(invoice.total_amount).toFixed(2)} {invoice.currency}
                </span>
              </div>
              <div className="flex justify-between text-sm text-emerald-400">
                <span>Amount Paid:</span>
                <span className="font-mono font-semibold">
                  ${Number(invoice.amount_paid).toFixed(2)} {invoice.currency}
                </span>
              </div>
              <div className="flex justify-between text-base font-extrabold pt-2 border-t border-slate-800">
                <span className="text-slate-200">Balance Due:</span>
                <span
                  className={`font-mono text-lg ${
                    Number(invoice.balance_due) > 0
                      ? invoice.effective_status === "overdue"
                        ? "text-rose-400"
                        : "text-amber-400"
                      : "text-emerald-400"
                  }`}
                >
                  ${Number(invoice.balance_due).toFixed(2)} {invoice.currency}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Payments History Ledger */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-bold text-white">Payment Transactions Ledger</h3>
            </div>
            {!isDraft && !isCancelled && !isPaid && (
              <button
                onClick={openRecordPaymentModal}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Record Payment</span>
              </button>
            )}
          </div>

          {loadingHistory ? (
            <div className="py-6 text-center text-slate-400 text-sm">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
              Loading payments...
            </div>
          ) : payments.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm border border-dashed border-slate-800 rounded-xl">
              No payments recorded yet for this invoice.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Payment #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Source</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {payments.map((p) => {
                    const isRev = p.payment_status === "reversed";
                    return (
                      <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3 font-mono font-medium text-slate-200">
                          {p.payment_number || p.id.slice(0, 8)}
                        </td>
                        <td className="py-3 px-3 text-slate-300">{p.payment_date}</td>
                        <td className="py-3 px-3 text-slate-300 capitalize">{p.payment_method.replace("_", " ")}</td>
                        <td className="py-3 px-3">
                          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {p.is_manual ? "Manual" : "Gateway"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold">
                          <span className={isRev ? "line-through text-slate-500" : "text-emerald-400"}>
                            {p.currency} {Number(p.amount).toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${
                              p.payment_status === "completed"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            {p.payment_status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-400 font-mono">{p.reference || "—"}</td>
                        <td className="py-3 px-3 text-right">
                          {p.payment_status === "completed" && (
                            <button
                              onClick={() => {
                                setReversingPayment(p);
                                setReversalReason("");
                                setReversalError(null);
                              }}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium transition"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reverse</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section: Email & Notification Delivery History */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Mail className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-bold text-white">Email & Reminder Delivery Log</h3>
            </div>
            {!isDraft && !isCancelled && (
              <button
                onClick={() => {
                  setEmailSubject(`Invoice ${invoice.invoice_number} from ${activeOrganization?.name || "InvoiceFlow AI"}`);
                  setShowEmailModal(true);
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Notification</span>
              </button>
            )}
          </div>

          {loadingHistory ? (
            <div className="py-6 text-center text-slate-400 text-sm">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
              Loading delivery logs...
            </div>
          ) : emailLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm border border-dashed border-slate-800 rounded-xl">
              No email notifications recorded for this invoice yet.
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
                  {emailLogs.map((log) => (
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
                        {log.provider_message_id ? (
                          <span className="text-slate-300">{log.provider_message_id}</span>
                        ) : log.error_message ? (
                          <span className="text-rose-400">{log.error_message}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Record Payment */}
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div className="flex items-center space-x-2 text-emerald-400">
                  <CreditCard className="w-5 h-5" />
                  <h3 className="text-lg font-bold text-white">Record Invoice Payment</h3>
                </div>
                <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white">
                  ✕
                </button>
              </div>

              {/* Balance Summary Box */}
              <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 mb-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <span className="text-slate-400 block">Total Amount</span>
                  <span className="font-bold text-white font-mono mt-0.5 block">
                    {invoice.currency} {Number(invoice.total_amount).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Already Paid</span>
                  <span className="font-bold text-emerald-400 font-mono mt-0.5 block">
                    {invoice.currency} {Number(invoice.amount_paid).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Remaining Balance</span>
                  <span className="font-bold text-amber-400 font-mono mt-0.5 block">
                    {invoice.currency} {Number(invoice.balance_due).toFixed(2)}
                  </span>
                </div>
              </div>

              {paymentError && (
                <div className="bg-rose-950/60 border border-rose-800 rounded-lg p-3 text-xs text-rose-300 mb-4">
                  {paymentError}
                </div>
              )}

              <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Payment Amount ({invoice.currency}) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={Number(invoice.balance_due)}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Payment Date <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Payment Method <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="credit_card">Credit Card</option>
                      <option value="cash">Cash</option>
                      <option value="check">Check</option>
                      <option value="online_gateway">Online Gateway</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Transaction Reference / Check #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. WIRE-88492"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Audit Notes</label>
                  <input
                    type="text"
                    placeholder="Optional internal note regarding this settlement"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Manual Disclosure & Confirmation */}
                <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                  <label className="flex items-start space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={paymentConfirmed}
                      onChange={(e) => setPaymentConfirmed(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-300">
                      I confirm this payment was received and acknowledge it will be labeled as a{" "}
                      <strong className="text-white">manually recorded payment</strong> in audit logs.
                    </span>
                  </label>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    disabled={paymentSubmitting}
                    className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={paymentSubmitting || !paymentConfirmed}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition disabled:opacity-50 flex items-center space-x-2 shadow-lg shadow-emerald-600/20"
                  >
                    {paymentSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Record Payment</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Send Invoice via Email */}
        {showEmailModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div className="flex items-center space-x-2 text-indigo-400">
                  <Mail className="w-5 h-5" />
                  <h3 className="text-lg font-bold text-white">Send Invoice via Email</h3>
                </div>
                <button onClick={() => setShowEmailModal(false)} className="text-slate-400 hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSendInvoiceEmail} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Recipient Email Address <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={emailRecipient}
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Subject</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Personal Note (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Add an optional note to be included in the email body..."
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailAttachPdf}
                      onChange={(e) => setEmailAttachPdf(e.target.checked)}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-300">
                      Attach official invoice PDF (<span className="font-mono text-indigo-400">{invoice.invoice_number}.pdf</span>)
                    </span>
                  </label>
                </div>

                <p className="text-[11px] text-slate-400">
                  Note: The email will be dispatched via the configured SMTP transactional email provider. Delivery status will be recorded.
                </p>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    disabled={emailSubmitting}
                    className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={emailSubmitting}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition disabled:opacity-50 flex items-center space-x-2 shadow-lg shadow-indigo-600/20"
                  >
                    {emailSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Dispatch Email</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Reverse Payment */}
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
                . In accordance with GAAP audit rules, this entry will be marked as reversed and outstanding invoice balances will be atomically recalculated.
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
                    placeholder="e.g. Check returned for NSF / duplicate recording correction"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setReversingPayment(null)}
                    disabled={reversalSubmitting}
                    className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reversalSubmitting}
                    className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition disabled:opacity-50 flex items-center space-x-2 shadow-lg shadow-rose-600/20"
                  >
                    {reversalSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Confirm Reversal</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Invoice Cancellation */}
        {showCancelModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 text-rose-400">
                <XCircle className="w-5 h-5" />
                Cancel Invoice
              </h3>
              <p className="text-sm text-slate-400">
                Cancelling marks this invoice as void. This action cannot be reversed. Please state a reason:
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
