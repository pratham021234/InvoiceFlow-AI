"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api, Client } from "@/lib/api";
import Navigation from "@/components/Navigation";
import {
  Users,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Archive,
  RefreshCw,
  Mail,
  Phone,
  Building,
  DollarSign,
  AlertCircle,
} from "lucide-react";

export default function ClientsPage() {
  const { activeOrganization, loading: authLoading } = useAuth();
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [skip, setSkip] = useState(0);
  const limit = 10;

  const fetchClients = useCallback(async () => {
    if (!activeOrganization) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.clients.list(activeOrganization.id, {
        skip,
        limit,
        search: search.trim() || undefined,
        is_archived: showArchived,
      });
      setClients(res.items);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message || "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, [activeOrganization, skip, limit, search, showArchived]);

  useEffect(() => {
    if (!authLoading && !activeOrganization) {
      router.push("/dashboard");
    } else if (activeOrganization) {
      fetchClients();
    }
  }, [authLoading, activeOrganization, fetchClients, router]);

  const handleArchiveToggle = async (client: Client) => {
    if (!activeOrganization) return;
    try {
      if (client.is_archived) {
        await api.clients.restore(activeOrganization.id, client.id);
      } else {
        await api.clients.archive(activeOrganization.id, client.id);
      }
      fetchClients();
    } catch (err: any) {
      alert(err.message || "Action failed");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Users className="w-8 h-8 text-indigo-400" />
              Client CRM
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Manage your client relationships, billing details, and outstanding balances.
            </p>
          </div>
          <Link
            href="/clients/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Add New Client
          </Link>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 mb-6 shadow-xl backdrop-blur-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search by client name, email, or contact..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSkip(0);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 select-none bg-slate-800/60 px-3 py-2 rounded-xl border border-slate-700/80 hover:bg-slate-800 transition">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => {
                  setShowArchived(e.target.checked);
                  setSkip(0);
                }}
                className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <span>Include Archived</span>
            </label>

            <button
              onClick={() => fetchClients()}
              title="Refresh"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 mb-6 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Clients Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Client Name</th>
                  <th className="px-6 py-4">Contact Info</th>
                  <th className="px-6 py-4">Country</th>
                  <th className="px-6 py-4 text-right">Outstanding</th>
                  <th className="px-6 py-4 text-right">Total Invoiced</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-normal">
                {loading && clients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                      Loading clients...
                    </td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                      <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-base font-semibold text-slate-200">No clients found</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        {search
                          ? "Try adjusting your search query or filters."
                          : "Start building your customer records by creating your first client."}
                      </p>
                      {!search && (
                        <Link
                          href="/clients/new"
                          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Client
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  clients.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-6 py-4">
                        <Link
                          href={`/clients/${c.id}`}
                          className="font-semibold text-white hover:text-indigo-400 transition flex items-center gap-2"
                        >
                          <Building className="w-4 h-4 text-slate-500" />
                          {c.name}
                        </Link>
                        {c.contact_name && (
                          <div className="text-xs text-slate-400 mt-0.5">{c.contact_name}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5 text-xs text-slate-300">
                          {c.email && (
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-slate-500" />
                              <span>{c.email}</span>
                            </div>
                          )}
                          {c.phone && (
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <Phone className="w-3.5 h-3.5 text-slate-500" />
                              <span>{c.phone}</span>
                            </div>
                          )}
                          {!c.email && !c.phone && <span className="text-slate-500 italic">No contact details</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-300 font-medium">
                        {c.country || "US"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`font-semibold ${
                            Number(c.outstanding_balance) > 0 ? "text-amber-400" : "text-slate-400"
                          }`}
                        >
                          ${Number(c.outstanding_balance).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-300">
                        ${Number(c.total_invoiced).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            c.is_archived
                              ? "bg-slate-800 text-slate-400 border border-slate-700"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {c.is_archived ? "Archived" : "Active"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/clients/${c.id}`}
                            title="View Details"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/clients/${c.id}/edit`}
                            title="Edit Client"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleArchiveToggle(c)}
                            title={c.is_archived ? "Restore Client" : "Archive Client"}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
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
                Showing {skip + 1} to {Math.min(skip + limit, total)} of {total} clients
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
      </main>
    </div>
  );
}
