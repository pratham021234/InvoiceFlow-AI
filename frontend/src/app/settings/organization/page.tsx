"use client";

import React, { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/context/AuthContext";
import { api, OrganizationDetail } from "@/lib/api";
import {
  Settings,
  Building2,
  Users,
  ShieldCheck,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";

export default function OrganizationSettingsPage() {
  const { activeOrganization, refreshOrganizations } = useAuth();
  const [orgDetails, setOrgDetails] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("United States");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("UTC");
  const [taxId, setTaxId] = useState("");
  const [invoicePrefix, setInvoicePrefix] = useState("INV");
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState("1001");
  const [paymentInstructions, setPaymentInstructions] = useState("");

  const isOwnerOrAdmin =
    activeOrganization?.user_role === "owner" || activeOrganization?.user_role === "admin";

  useEffect(() => {
    async function fetchOrgDetails() {
      if (!activeOrganization) return;
      setLoading(true);
      try {
        const data = await api.organizations.get(activeOrganization.id);
        setOrgDetails(data);
        setName(data.name || "");
        setEmail(data.email || "");
        setPhone(data.phone || "");
        setAddress(data.address || "");
        setCountry(data.country || "United States");
        setCurrency(data.currency || "USD");
        setTimezone(data.timezone || "UTC");
        setTaxId(data.tax_id || "");
        setInvoicePrefix(data.invoice_prefix || "INV");
        setNextInvoiceNumber(data.next_invoice_number || "1001");
        setPaymentInstructions(data.payment_instructions || "");
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to load organization settings.");
      } finally {
        setLoading(false);
      }
    }

    fetchOrgDetails();
  }, [activeOrganization]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrganization) return;

    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await api.organizations.update(activeOrganization.id, {
        name,
        email: email || undefined,
        phone: phone || undefined,
        address: address || undefined,
        country,
        currency,
        timezone,
        tax_id: taxId || undefined,
        invoice_prefix: invoicePrefix,
        next_invoice_number: nextInvoiceNumber,
        payment_instructions: paymentInstructions || undefined,
      });

      setSuccessMessage("Organization settings updated successfully.");
      await refreshOrganizations();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save organization settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <Settings className="w-6 h-6 text-indigo-400" />
              Organization & Business Settings
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Configure your business identity, tax credentials, invoice prefixes, and payment terms.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase">
              Role: {activeOrganization?.user_role || "member"}
            </span>
          </div>
        </div>

        {successMessage && (
          <div className="mb-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center space-x-3 text-emerald-400 text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 rounded-lg bg-rose-500/10 border border-rose-500/20 p-4 flex items-center space-x-3 text-rose-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {!isOwnerOrAdmin && (
          <div className="mb-6 rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 flex items-start space-x-3 text-amber-300 text-sm">
            <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>
              You have read-only access as a Member. Only organization Owners and Admins can update business settings.
            </span>
          </div>
        )}

        <div className="space-y-8">
          {/* Main Settings Form */}
          <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-400" />
              General Business Profile
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Business Name
                </label>
                <input
                  type="text"
                  required
                  disabled={!isOwnerOrAdmin}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Business Contact Email
                </label>
                <input
                  type="email"
                  disabled={!isOwnerOrAdmin}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="billing@yourdomain.com"
                  className="mt-1 block w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Phone Number
                </label>
                <input
                  type="text"
                  disabled={!isOwnerOrAdmin}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 019-2834"
                  className="mt-1 block w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Tax Identifier / VAT / EIN
                </label>
                <input
                  type="text"
                  disabled={!isOwnerOrAdmin}
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="e.g. 12-3456789 or GB123456789"
                  className="mt-1 block w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-60"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300">
                Billing Address
              </label>
              <textarea
                rows={2}
                disabled={!isOwnerOrAdmin}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="100 Market Street, Suite 400, San Francisco, CA 94105"
                className="mt-1 block w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-60"
              />
            </div>

            <div className="border-t border-slate-800 pt-6 mt-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Invoicing & Localization
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Default Currency
                  </label>
                  <select
                    disabled={!isOwnerOrAdmin}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="mt-1 block w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-60"
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
                    Invoice Prefix
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isOwnerOrAdmin}
                    value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value)}
                    maxLength={10}
                    className="mt-1 block w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm uppercase disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300">
                    Next Invoice Number
                  </label>
                  <input
                    type="text"
                    disabled={!isOwnerOrAdmin}
                    value={nextInvoiceNumber}
                    onChange={(e) => setNextInvoiceNumber(e.target.value)}
                    className="mt-1 block w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Payment Instructions / Bank Wire Details
                </label>
                <textarea
                  rows={3}
                  disabled={!isOwnerOrAdmin}
                  value={paymentInstructions}
                  onChange={(e) => setPaymentInstructions(e.target.value)}
                  placeholder="Wire Transfer: Bank of America, Account: 123456789, Routing: 987654321, Swift: BOFAUS3N"
                  className="mt-1 block w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-60"
                />
              </div>
            </div>

            {isOwnerOrAdmin && (
              <div className="pt-6 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Saving Settings...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            )}
          </form>

          {/* Members Roster */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              Workspace Members
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {orgDetails?.members.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-sm font-medium text-white">{member.user_name || "Workspace Member"}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{member.user_email || "—"}</td>
                      <td className="px-4 py-3 text-xs uppercase font-semibold text-indigo-400">{member.role}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {member.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
