"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api, Client, Invoice, InvoiceCreate } from "@/lib/api";
import Navigation from "@/components/Navigation";
import {
  ArrowLeft,
  Receipt,
  Plus,
  Trash2,
  Calendar,
  Building,
  DollarSign,
  AlertCircle,
  Save,
  Send,
  RefreshCw,
  Lock,
} from "lucide-react";

interface FormLineItem {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
  discount_percent: string;
  tax_rate: string;
}

function EditInvoiceContent() {
  const params = useParams();
  const invoiceId = params.id as string;

  const { activeOrganization, loading: authLoading } = useAuth();
  const router = useRouter();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [clientId, setClientId] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<FormLineItem[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !activeOrganization) {
      router.push("/dashboard");
    } else if (activeOrganization) {
      const loadData = async () => {
        try {
          const [inv, clientsRes] = await Promise.all([
            api.invoices.get(activeOrganization.id, invoiceId),
            api.clients.list(activeOrganization.id, { is_archived: false, limit: 100 }),
          ]);
          setInvoice(inv);
          setClients(clientsRes.items);

          setClientId(inv.client_id);
          setIssueDate(inv.issue_date);
          setDueDate(inv.due_date);
          setCurrency(inv.currency);
          setPaymentTerms(inv.payment_terms || "");
          setNotes(inv.notes || "");
          setItems(
            inv.items.map((it, idx) => ({
              id: it.id || `item-${idx}`,
              description: it.description,
              quantity: String(it.quantity),
              unit_price: String(it.unit_price),
              discount_percent: String(it.discount_percent),
              tax_rate: String(it.tax_rate),
            }))
          );
        } catch (err: any) {
          setError(err.message || "Failed to load invoice.");
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }
  }, [authLoading, activeOrganization, invoiceId, router]);

  // Live Calculations Preview
  const previewTotals = useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;

    const lineCalculations = items.map((it) => {
      const q = parseFloat(it.quantity) || 0;
      const p = parseFloat(it.unit_price) || 0;
      const d = parseFloat(it.discount_percent) || 0;
      const t = parseFloat(it.tax_rate) || 0;

      const lineSubtotal = q * p;
      const lineDiscount = lineSubtotal * (Math.min(100, Math.max(0, d)) / 100);
      const taxable = Math.max(0, lineSubtotal - lineDiscount);
      const lineTax = taxable * (Math.min(100, Math.max(0, t)) / 100);
      const lineTotal = taxable + lineTax;

      subtotal += lineSubtotal;
      discountTotal += lineDiscount;
      taxTotal += lineTax;

      return {
        lineSubtotal,
        lineDiscount,
        lineTax,
        lineTotal,
      };
    });

    const grandTotal = subtotal - discountTotal + taxTotal;

    return {
      subtotal,
      discountTotal,
      taxTotal,
      grandTotal,
      lineCalculations,
    };
  }, [items]);

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: `item-${Date.now()}`,
        description: "",
        quantity: "1",
        unit_price: "0.00",
        discount_percent: "0",
        tax_rate: "0",
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      alert("An invoice must contain at least one line item.");
      return;
    }
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof FormLineItem, value: string) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const handleSubmit = async (shouldIssue: boolean) => {
    if (!activeOrganization) return;
    if (items.some((it) => !it.description.trim())) {
      setError("All line items must have a description.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload: Partial<InvoiceCreate> = {
      client_id: clientId,
      issue_date: issueDate,
      due_date: dueDate,
      currency: currency.toUpperCase(),
      notes: notes.trim() || undefined,
      payment_terms: paymentTerms.trim() || undefined,
      items: items.map((it, idx) => ({
        description: it.description.trim(),
        quantity: parseFloat(it.quantity) || 1,
        unit_price: parseFloat(it.unit_price) || 0,
        discount_percent: parseFloat(it.discount_percent) || 0,
        tax_rate: parseFloat(it.tax_rate) || 0,
        display_order: idx,
      })),
    };

    try {
      await api.invoices.update(activeOrganization.id, invoiceId, payload);

      if (shouldIssue) {
        await api.invoices.issue(activeOrganization.id, invoiceId);
      }

      router.push(`/invoices/${invoiceId}`);
    } catch (err: any) {
      setError(err.message || "Failed to update draft invoice.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-400" />
          Loading invoice...
        </div>
      </div>
    );
  }

  // Immutable invoice safeguard
  if (invoice && invoice.status !== "draft") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <Navigation />
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
            <Lock className="w-12 h-12 text-amber-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">Invoice Is Finalized & Immutable</h2>
            <p className="text-sm text-slate-400">
              Invoice <strong>{invoice.invoice_number}</strong> has already been issued ({invoice.status}).
              To preserve accounting and legal integrity, issued invoices cannot be directly rewritten.
              You may duplicate this document into a new draft or cancel it.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Link
                href={`/invoices/${invoice.id}`}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition"
              >
                View Invoice
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navigation />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <Link
          href={`/invoices/${invoiceId}`}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invoice View
        </Link>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Receipt className="w-8 h-8 text-indigo-400" />
            Edit Draft Invoice
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Editing draft {invoice?.invoice_number}. Update line items, amounts, or terms.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-8">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Client *
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.contact_name ? `(${c.contact_name})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Issue Date *
              </label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Due Date *
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD ($)</option>
                <option value="AUD">AUD ($)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Payment Terms
              </label>
              <input
                type="text"
                placeholder="e.g. Net 14, Net 30, Due upon receipt"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">Line Items</h2>
              <span className="text-xs text-slate-500">Live preview calculations</span>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => {
                const lineCalc = previewTotals.lineCalculations[index];
                return (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-850 rounded-xl border border-slate-800/80 flex flex-col md:flex-row gap-4 items-start md:items-center"
                  >
                    <div className="flex-1 w-full">
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                        Item Description *
                      </label>
                      <input
                        type="text"
                        required
                        value={item.description}
                        onChange={(e) => handleItemChange(index, "description", e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>

                    <div className="w-24">
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                        Qty
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.0001"
                        required
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>

                    <div className="w-28">
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                        Unit Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, "unit_price", e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>

                    <div className="w-24">
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                        Disc %
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={item.discount_percent}
                        onChange={(e) => handleItemChange(index, "discount_percent", e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>

                    <div className="w-24">
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                        Tax %
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={item.tax_rate}
                        onChange={(e) => handleItemChange(index, "tax_rate", e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>

                    <div className="w-28 text-right self-end md:self-center">
                      <span className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                        Line Total
                      </span>
                      <div className="text-sm font-bold text-white py-1">
                        ${lineCalc?.lineTotal ? lineCalc.lineTotal.toFixed(2) : "0.00"}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      title="Remove Item"
                      className="p-2 text-slate-500 hover:text-rose-400 transition self-end md:self-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-400 text-xs font-semibold border border-slate-700 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Another Line Item
            </button>
          </div>

          {/* Notes & Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Notes / Payment Instructions
              </label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div className="bg-slate-850 border border-slate-800 rounded-2xl p-6 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
                Financial Summary Preview
              </div>
              <div className="flex justify-between text-sm text-slate-300">
                <span>Subtotal:</span>
                <span className="font-medium">${previewTotals.subtotal.toFixed(2)}</span>
              </div>
              {previewTotals.discountTotal > 0 && (
                <div className="flex justify-between text-sm text-emerald-400">
                  <span>Discounts Applied:</span>
                  <span className="font-medium">-${previewTotals.discountTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-slate-300">
                <span>Total Tax:</span>
                <span className="font-medium">${previewTotals.taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-white pt-3 border-t border-slate-800">
                <span>Grand Total:</span>
                <span className="text-indigo-400 text-lg">
                  ${previewTotals.grandTotal.toFixed(2)} {currency}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-6 border-t border-slate-800">
            <Link
              href={`/invoices/${invoiceId}`}
              className="w-full sm:w-auto px-5 py-2.5 text-center rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
            >
              Cancel
            </Link>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(false)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium disabled:opacity-50 transition"
            >
              <Save className="w-4 h-4 text-indigo-400" />
              Save Changes
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                if (confirm("Save changes and officially issue this invoice?")) {
                  handleSubmit(true);
                }
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition hover:scale-[1.02]"
            >
              <Send className="w-4 h-4" />
              {submitting ? "Processing..." : "Save & Issue"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function EditInvoicePage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center text-sm text-slate-400">
          Loading invoice editor...
        </div>
      }
    >
      <EditInvoiceContent />
    </React.Suspense>
  );
}
