"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navigation from "@/components/Navigation";
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
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { user, activeOrganization, organizations, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm">Loading InvoiceFlow AI workspace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Workspace Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl mb-8 relative overflow-hidden">
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
                Workspace Currency: <span className="text-slate-200 font-medium">{activeOrganization?.currency || "USD"}</span> • Invoice Prefix: <span className="text-slate-200 font-medium">{activeOrganization?.invoice_prefix || "INV"}</span> • Next Number: <span className="text-slate-200 font-medium">{activeOrganization?.next_invoice_number || "1001"}</span>
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <Link
                href="/settings/organization"
                className="flex items-center space-x-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-sm font-medium text-slate-200 transition-colors shadow-sm"
              >
                <Settings className="w-4 h-4 text-slate-400" />
                <span>Org Settings</span>
              </Link>
              <Link
                href="/invoices/new"
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors shadow-lg shadow-indigo-600/20"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Invoice</span>
              </Link>
              <Link
                href="/clients/new"
                className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-slate-200 transition-colors"
              >
                <span>Add Client</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Financial KPI Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Total Invoiced</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <FileCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-white">$0.00</div>
              <div className="flex items-center text-xs text-slate-400 mt-1">
                <span>0 active invoices issued</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Payments Collected</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-emerald-400">$0.00</div>
              <div className="flex items-center text-xs text-slate-400 mt-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                <span>100% collection rate</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Outstanding Balance</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-amber-400">$0.00</div>
              <div className="flex items-center text-xs text-slate-400 mt-1">
                <span>Awaiting payment</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Overdue Balance</span>
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-rose-400">$0.00</div>
              <div className="flex items-center text-xs text-slate-400 mt-1">
                <span>0 invoices past due</span>
              </div>
            </div>
          </div>
        </div>

        {/* Phase 2 Multi-Tenant Verification Card */}
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
