"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, User, Organization, setStoredToken } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  activeOrganization: Organization | null;
  organizations: Organization[];
  isLoading: boolean;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, orgName?: string) => Promise<void>;
  logout: () => Promise<void>;
  switchOrganization: (orgId: string) => void;
  refreshOrganizations: () => Promise<void>;
  setActiveOrganization: (org: Organization) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  // Load session from stored token on mount
  useEffect(() => {
    async function initAuth() {
      const token = typeof window !== "undefined" ? localStorage.getItem("invoiceflow_token") : null;
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const userData = await api.auth.getMe();
        setUser(userData);

        const orgList = await api.organizations.list();
        setOrganizations(orgList);

        // Retrieve last active organization ID from storage or take first
        const savedOrgId = localStorage.getItem("invoiceflow_active_org_id");
        const found = orgList.find((o) => o.id === savedOrgId);
        if (found) {
          setActiveOrganization(found);
        } else if (orgList.length > 0) {
          setActiveOrganization(orgList[0]);
          localStorage.setItem("invoiceflow_active_org_id", orgList[0].id);
        }
      } catch (err) {
        console.error("Session verification failed:", err);
        setStoredToken(null);
        setUser(null);
        setActiveOrganization(null);
        setOrganizations([]);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.auth.login({ email, password });
      setStoredToken(res.access_token);
      setUser(res.user);

      const orgList = await api.organizations.list();
      setOrganizations(orgList);

      if (res.active_organization) {
        setActiveOrganization(res.active_organization);
        localStorage.setItem("invoiceflow_active_org_id", res.active_organization.id);
      } else if (orgList.length > 0) {
        setActiveOrganization(orgList[0]);
        localStorage.setItem("invoiceflow_active_org_id", orgList[0].id);
      }

      router.push("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, fullName: string, orgName?: string) => {
    setIsLoading(true);
    try {
      const res = await api.auth.register({
        email,
        password,
        full_name: fullName,
        organization_name: orgName,
      });
      setStoredToken(res.access_token);
      setUser(res.user);

      const orgList = await api.organizations.list();
      setOrganizations(orgList);

      if (res.active_organization) {
        setActiveOrganization(res.active_organization);
        localStorage.setItem("invoiceflow_active_org_id", res.active_organization.id);
      } else if (orgList.length > 0) {
        setActiveOrganization(orgList[0]);
        localStorage.setItem("invoiceflow_active_org_id", orgList[0].id);
      }

      router.push("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      setStoredToken(null);
      setUser(null);
      setActiveOrganization(null);
      setOrganizations([]);
      localStorage.removeItem("invoiceflow_active_org_id");
      router.push("/login");
    }
  };

  const switchOrganization = (orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      setActiveOrganization(org);
      localStorage.setItem("invoiceflow_active_org_id", org.id);
    }
  };

  const refreshOrganizations = async () => {
    try {
      const list = await api.organizations.list();
      setOrganizations(list);
      if (activeOrganization) {
        const updated = list.find((o) => o.id === activeOrganization.id);
        if (updated) {
          setActiveOrganization(updated);
        }
      }
    } catch (e) {
      console.error("Failed to refresh organizations:", e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeOrganization,
        organizations,
        isLoading,
        loading: isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        switchOrganization,
        refreshOrganizations,
        setActiveOrganization,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
