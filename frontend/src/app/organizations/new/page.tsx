"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Building2, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function NewOrganizationPage() {
  const router = useRouter();
  const { refreshOrganizations, switchOrganization } = useAuth();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [country, setCountry] = useState("United States");
  const [timezone] = useState("UTC");
  const [invoicePrefix, setInvoicePrefix] = useState("INV");
  const [taxId, setTaxId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const newOrg = await api.organizations.create({
        name,
        currency,
        country,
        timezone,
        invoice_prefix: invoicePrefix,
        tax_id: taxId || undefined,
      });

      await refreshOrganizations();
      switchOrganization(newOrg.id);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to create organization.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-10">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-indigo-400" />
            Create New Workspace
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Create an isolated multi-tenant organization with its own currency, clients, invoices, and settings.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
          {error && (
            <div className="mb-6 rounded-lg bg-rose-500/10 border border-rose-500/20 p-4 flex items-start space-x-3 text-rose-400 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Organization / Business Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Apex Digital Consulting"
                className="mt-1 block w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Default Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="mt-1 block w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  <option value="USD">USD ($) - US Dollar</option>
                  <option value="EUR">EUR (€) - Euro</option>
                  <option value="GBP">GBP (£) - British Pound</option>
                  <option value="CAD">CAD ($) - Canadian Dollar</option>
                  <option value="AUD">AUD ($) - Australian Dollar</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Country
                </label>
                <input
                  type="text"
                  required
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="United States"
                  className="mt-1 block w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Invoice Number Prefix
                </label>
                <input
                  type="text"
                  required
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value)}
                  placeholder="INV"
                  maxLength={10}
                  className="mt-1 block w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm uppercase"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Tax Identifier (EIN / VAT / GST)
                </label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="Optional"
                  className="mt-1 block w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end space-x-3">
              <Link
                href="/dashboard"
                className="px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating Workspace...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Create Workspace
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
