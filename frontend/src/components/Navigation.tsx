"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  FileText,
  Building2,
  Settings,
  LogOut,
  ChevronDown,
  PlusCircle,
  LayoutDashboard,
  User,
  Users,
  Receipt,
  CreditCard,
  Clock,
  BarChart3,
} from "lucide-react";

export default function Navigation() {
  const { user, activeOrganization, organizations, switchOrganization, logout } = useAuth();
  const pathname = usePathname();
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center space-x-8">
          <Link href="/dashboard" className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">
              InvoiceFlow<span className="text-indigo-400">.AI</span>
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex space-x-1">
            <Link
              href="/dashboard"
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === "/dashboard"
                  ? "bg-slate-800 text-indigo-400"
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/invoices"
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname.startsWith("/invoices")
                  ? "bg-slate-800 text-indigo-400"
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Invoices</span>
            </Link>
            <Link
              href="/payments"
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname.startsWith("/payments")
                  ? "bg-slate-800 text-indigo-400"
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Payments</span>
            </Link>
            <Link
              href="/receivables"
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname.startsWith("/receivables")
                  ? "bg-slate-800 text-indigo-400"
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Receivables</span>
            </Link>
            <Link
              href="/analytics"
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname.startsWith("/analytics")
                  ? "bg-slate-800 text-indigo-400"
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Analytics</span>
            </Link>
            <Link
              href="/clients"
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname.startsWith("/clients")
                  ? "bg-slate-800 text-indigo-400"
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Clients</span>
            </Link>
            <Link
              href="/settings/organization"
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname.startsWith("/settings")
                  ? "bg-slate-800 text-indigo-400"
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Org Settings</span>
            </Link>
          </nav>
        </div>

        {/* Right: Organization Switcher & User Profile */}
        <div className="flex items-center space-x-4">
          {/* Organization Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setOrgDropdownOpen(!orgDropdownOpen);
                setUserDropdownOpen(false);
              }}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-sm text-slate-200 transition-colors"
            >
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span className="font-medium max-w-[140px] truncate">
                {activeOrganization ? activeOrganization.name : "Select Workspace"}
              </span>
              {activeOrganization?.user_role && (
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {activeOrganization.user_role}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {orgDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl py-2 z-50">
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Workspaces
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => {
                        switchOrganization(org.id);
                        setOrgDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-800 transition-colors ${
                        activeOrganization?.id === org.id
                          ? "bg-indigo-600/10 text-indigo-400 font-semibold"
                          : "text-slate-300"
                      }`}
                    >
                      <span className="truncate">{org.name}</span>
                      {org.user_role && (
                        <span className="text-[10px] text-slate-400 uppercase">
                          {org.user_role}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-800 mt-1 pt-1">
                  <Link
                    href="/organizations/new"
                    onClick={() => setOrgDropdownOpen(false)}
                    className="flex items-center space-x-2 px-3 py-2 text-sm text-indigo-400 hover:bg-slate-800 transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Create New Workspace</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Profile & Logout Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setUserDropdownOpen(!userDropdownOpen);
                setOrgDropdownOpen(false);
              }}
              className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-300">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl py-2 z-50">
                <div className="px-4 py-2 border-b border-slate-800">
                  <p className="text-sm font-semibold text-white truncate">{user?.full_name}</p>
                  <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    logout();
                  }}
                  className="w-full text-left flex items-center space-x-2 px-4 py-2.5 text-sm text-rose-400 hover:bg-slate-800 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
