"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api, Client, Invoice } from "@/lib/api";
import Navigation from "@/components/Navigation";
import {
  ArrowLeft,
  Building,
  User,
  Mail,
  Phone,
  MapPin,
  Globe,
  FileBadge,
  FileText,
  Edit2,
  Archive,
  Plus,
  Receipt,
  Calendar,
  DollarSign,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

function ClientDetailContent() {
  const params = useParams();
  const clientId = params.id as string;

  const { activeOrganization, loading: authLoading } = useAuth();
  const router = useRouter();

  const [client, setClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClientData = async () => {
    if (!activeOrganization) return;
    setLoading(true);
    setError(null);
    try {
      const [clientData, invResponse] = await Promise.all([
        api.clients.get(activeOrganization.id, clientId),
        api.clients.invoices(activeOrganization.id, clientId),
      ]);
      setClient(clientData);
      const invList = Array.isArray(invResponse) ? invResponse : ((invResponse as any)?.items || []);
      setInvoices(invList);
    } catch (err: any) {
      setError(err.message || "Failed to load client details");
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !activeOrganization) {
      router.push("/dashboard");
    } else if (activeOrganization) {
      fetchClientData();
    }
  }, [authLoading, activeOrganization, clientId]);

  const handleArchiveToggle = async () => {
    if (!activeOrganization || !client) return;
    try {
      if (client.is_archived) {
        await api.clients.restore(activeOrganization.id, client.id);
      } else {
        await api.clients.archive(activeOrganization.id, client.id);
      }
      fetchClientData();
    } catch (err: any) {
      alert(err.message || "Failed to update archive status.");
    }
  };

  if (loading && !client) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 py-20 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-400" />
          Loading client profile...
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <Navigation />
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">Client Not Found</h2>
            <p className="text-sm text-slate-400">{error || "This client does not exist or has been removed."}</p>
            <Link
              href="/clients"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Clients
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Header & Breadcrumb */}
        <div>
          <Link
            href="/clients"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Clients
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
                <Building className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {client.name}
                  </h1>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      client.is_archived
                        ? "bg-slate-800 text-slate-400 border border-slate-700"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}
                  >
                    {client.is_archived ? "Archived" : "Active"}
                  </span>
                </div>
                {client.contact_name && (
                  <p className="text-slate-400 text-sm mt-0.5">Attn: {client.contact_name}</p>
                )}
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-3">
              <Link
                href={`/invoices/new?client_id=${client.id}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition hover:scale-[1.02]"
              >
                <Plus className="w-4 h-4" />
                Create Invoice
              </Link>
              <Link
                href={`/clients/${client.id}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium transition"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </Link>
              <button
                onClick={handleArchiveToggle}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-amber-400 text-sm font-medium transition"
              >
                <Archive className="w-4 h-4" />
                {client.is_archived ? "Restore" : "Archive"}
              </button>
            </div>
          </div>
        </div>

        {/* Financial Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Outstanding Balance
            </div>
            <div
              className={`text-3xl font-extrabold ${
                Number(client.outstanding_balance) > 0 ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              ${Number(client.outstanding_balance).toFixed(2)}
            </div>
            <div className="text-xs text-slate-500 mt-2">Unpaid or partially paid invoices</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Total Invoiced
            </div>
            <div className="text-3xl font-extrabold text-white">
              ${Number(client.total_invoiced).toFixed(2)}
            </div>
            <div className="text-xs text-slate-500 mt-2">Cumulative value of all issued invoices</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Total Invoices Count
            </div>
            <div className="text-3xl font-extrabold text-indigo-400">{invoices.length}</div>
            <div className="text-xs text-slate-500 mt-2">Issued and draft documents</div>
          </div>
        </div>

        {/* Client Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact and Billing Details */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <h2 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-400" />
              Contact & Billing Profile
            </h2>

            <div className="space-y-4 text-sm">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Email
                </span>
                {client.email ? (
                  <a
                    href={`mailto:${client.email}`}
                    className="text-indigo-400 hover:underline flex items-center gap-2"
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    {client.email}
                  </a>
                ) : (
                  <span className="text-slate-500 italic">Not provided</span>
                )}
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Phone
                </span>
                {client.phone ? (
                  <div className="text-slate-300 flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    {client.phone}
                  </div>
                ) : (
                  <span className="text-slate-500 italic">Not provided</span>
                )}
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Country
                </span>
                <div className="text-slate-300 flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                  {client.country || "US"}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Tax ID / VAT
                </span>
                {client.tax_id ? (
                  <div className="text-slate-300 flex items-center gap-2 font-mono">
                    <FileBadge className="w-3.5 h-3.5 text-slate-500" />
                    {client.tax_id}
                  </div>
                ) : (
                  <span className="text-slate-500 italic">Not specified</span>
                )}
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Billing Address
                </span>
                {client.billing_address ? (
                  <p className="text-slate-300 whitespace-pre-line leading-relaxed text-xs bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                    {client.billing_address}
                  </p>
                ) : (
                  <span className="text-slate-500 italic">No address on file</span>
                )}
              </div>

              {client.notes && (
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                    Internal Notes
                  </span>
                  <p className="text-slate-400 text-xs italic bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                    {client.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Invoices History Table */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-400" />
                Invoice History
              </h2>
              <Link
                href={`/invoices/new?client_id=${client.id}`}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                New Invoice
              </Link>
            </div>

            {invoices.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Receipt className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="font-semibold text-slate-300">No invoices generated yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Issue your first invoice to begin tracking billings for {client.name}.
                </p>
                <Link
                  href={`/invoices/new?client_id=${client.id}`}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
                >
                  Create Invoice
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="pb-3">Invoice #</th>
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Due Date</th>
                      <th className="pb-3 text-right">Amount</th>
                      <th className="pb-3 text-right">Balance Due</th>
                      <th className="pb-3 text-center">Status</th>
                      <th className="pb-3 text-right">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 font-semibold text-white">
                          <Link href={`/invoices/${inv.id}`} className="hover:text-indigo-400 transition">
                            {inv.invoice_number}
                          </Link>
                        </td>
                        <td className="py-3 text-xs text-slate-400">{inv.issue_date}</td>
                        <td className="py-3 text-xs text-slate-400">{inv.due_date}</td>
                        <td className="py-3 text-right font-medium text-slate-200">
                          ${Number(inv.total_amount).toFixed(2)}
                        </td>
                        <td className="py-3 text-right font-semibold">
                          <span
                            className={
                              Number(inv.balance_due) > 0 ? "text-amber-400" : "text-emerald-400"
                            }
                          >
                            ${Number(inv.balance_due).toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
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
                        <td className="py-3 text-right">
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition inline-block"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ClientDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center text-sm text-slate-400">
          Loading client profile...
        </div>
      }
    >
      <ClientDetailContent />
    </React.Suspense>
  );
}
