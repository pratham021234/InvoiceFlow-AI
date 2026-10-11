"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api, Client, InvoiceCreate } from "@/lib/api";
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
  HelpCircle,
} from "lucide-react";

interface FormLineItem {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
  discount_percent: string;
  tax_rate: string;
}

function NewInvoiceContent() {
  const { activeOrganization } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get("client_id") || "";

  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  // Form State
  const [clientId, setClientId] = useState(preselectedClientId);
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  });
  const [currency, setCurrency] = useState("USD");
  const [paymentTerms, setPaymentTerms] = useState("Net 14");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<FormLineItem[]>([
    {
      id: "item-1",
      description: "Consulting & Strategy Services",
      quantity: "1",
      unit_price: "150.00",
      discount_percent: "0",
      tax_rate: "0",
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load active clients
  useEffect(() => {
    if (!activeOrganization) return;
    const fetchClients = async () => {
      try {
        const res = await api.clients.list(activeOrganization.id, { is_archived: false, limit: 100 });
        setClients(res.items);
        if (preselectedClientId) {
          setClientId(preselectedClientId);
        } else if (res.items.length > 0 && !clientId) {
          setClientId(res.items[0].id);
        }
      } catch (err: any) {
        console.error("Failed to load clients", err);
      } finally {
        setLoadingClients(false);
      }
    };
    fetchClients();
  }, [activeOrganization, preselectedClientId]);

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
    if (!activeOrganization) {
      setError("No active organization found.");
      return;
    }
    if (!clientId) {
      setError("Please select a client for this invoice.");
      return;
    }
    if (items.some((it) => !it.description.trim())) {
      setError("All line items must have a description.");
      return;
    }
    if (items.some((it) => (parseFloat(it.quantity) || 0) <= 0)) {
      setError("Quantities must be greater than zero.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload: InvoiceCreate = {
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
      const created = await api.invoices.create(activeOrganization.id, payload);

      if (shouldIssue) {
        await api.invoices.issue(activeOrganization.id, created.id);
      }

      router.push(`/invoices/${created.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to save invoice.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navigation />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invoices
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Receipt className="w-8 h-8 text-indigo-400" />
              Invoice Builder
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Create a compliant financial invoice with live calculations and authoritative backend totals.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-8">
          {/* Top Invoice Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Client Picker */}
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Client *
              </label>
              {loadingClients ? (
                <div className="text-xs text-slate-400 py-2.5">Loading clients...</div>
              ) : clients.length === 0 ? (
                <div className="text-xs text-amber-400 py-2">
                  No active clients.{" "}
                  <Link href="/clients/new" className="underline font-semibold">
                    Create a client
                  </Link>{" "}
                  first.
                </div>
              ) : (
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="">Select a client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.contact_name ? `(${c.contact_name})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Issue Date */}
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

            {/* Due Date */}
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

            {/* Currency */}
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

            {/* Payment Terms */}
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

          {/* Line Items Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Invoice Line Items
              </h2>
              <span className="text-xs text-slate-500">Live preview amounts</span>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => {
                const lineCalc = previewTotals.lineCalculations[index];
                return (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-850 rounded-xl border border-slate-800/80 flex flex-col md:flex-row gap-4 items-start md:items-center"
                  >
                    {/* Description */}
                    <div className="flex-1 w-full">
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                        Item Description *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Description of service or product"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, "description", e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>

                    {/* Quantity */}
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

                    {/* Unit Price */}
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

                    {/* Discount % */}
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

                    {/* Tax % */}
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

                    {/* Line Total */}
                    <div className="w-28 text-right self-end md:self-center">
                      <span className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                        Line Total
                      </span>
                      <div className="text-sm font-bold text-white py-1">
                        ${lineCalc?.lineTotal ? lineCalc.lineTotal.toFixed(2) : "0.00"}
                      </div>
                    </div>

                    {/* Remove Action */}
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
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 text-xs font-semibold border border-slate-700 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Another Line Item
            </button>
          </div>

          {/* Notes and Financial Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-800">
            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Notes / Payment Instructions
              </label>
              <textarea
                rows={4}
                placeholder="Bank transfer details, payment link instructions, or terms..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            {/* Financial Summary Card */}
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
              <p className="text-[11px] text-slate-500 italic mt-1">
                * Browser preview. Exact calculations are validated authoritatively by backend decimal engine upon save.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-6 border-t border-slate-800">
            <Link
              href="/invoices"
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
              Save as Draft
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                if (confirm("Issuing will assign an official, sequential invoice number. Are you sure?")) {
                  handleSubmit(true);
                }
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition hover:scale-[1.02]"
            >
              <Send className="w-4 h-4" />
              {submitting ? "Processing..." : "Issue Invoice"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center text-sm text-slate-400">
          Loading invoice builder...
        </div>
      }
    >
      <NewInvoiceContent />
    </React.Suspense>
  );
}
