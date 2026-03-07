"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductProfile {
  productName: string;
  productDescription: string;
  isMultiPlatform: boolean;
  platforms: string[];
  hasAnalyzedData: boolean;
  totalConversations: number;
  analyzedCount: number;
  dateRange: { start: string | null; end: string | null };
}

interface ProductProfileContextValue {
  profile: ProductProfile | null;
  selectedPlatform: string;
  setSelectedPlatform: (p: string) => void;
  loading: boolean;
  error: string | null;
  // Editable overrides stored in localStorage
  editableName: string;
  editableDescription: string;
  setEditableName: (n: string) => void;
  setEditableDescription: (d: string) => void;
  retry: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ProductProfileContext = createContext<ProductProfileContextValue>({
  profile: null,
  selectedPlatform: "all",
  setSelectedPlatform: () => {},
  loading: true,
  error: null,
  editableName: "Character.ai",
  editableDescription:
    "2,500 companion conversations analyzed across roleplay, emotional support, casual chat, and 6 other intents.",
  setEditableName: () => {},
  setEditableDescription: () => {},
  retry: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ProductProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<ProductProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [editableName, setEditableNameState] = useState("Character.ai");
  const [editableDescription, setEditableDescriptionState] = useState(
    "2,500 companion conversations analyzed across roleplay, emotional support, casual chat, and 6 other intents."
  );

  // Load persisted values from localStorage on mount
  useEffect(() => {
    try {
      const storedName = localStorage.getItem("convometrics_product_name");
      const storedDesc = localStorage.getItem("convometrics_product_desc");
      if (storedName) setEditableNameState(storedName);
      if (storedDesc) setEditableDescriptionState(storedDesc);
    } catch (err) {
      // Silently handle localStorage errors (e.g., in incognito mode)
      console.warn('Failed to load from localStorage:', err);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/product-profile");
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch product profile`);
      }
      
      const data = await response.json();
      setProfile(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch product profile';
      setError(errorMessage);
      
      // Log error in development, could be sent to error reporting service in production
      if (process.env.NODE_ENV === 'development') {
        console.error('Product profile fetch error:', err);
      }
      
      // Set profile to null to indicate error state
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const setEditableName = useCallback((n: string) => {
    setEditableNameState(n);
    try { 
      localStorage.setItem("convometrics_product_name", n); 
    } catch (err) {
      console.warn('Failed to save to localStorage:', err);
    }
  }, []);

  const setEditableDescription = useCallback((d: string) => {
    setEditableDescriptionState(d);
    try { 
      localStorage.setItem("convometrics_product_desc", d); 
    } catch (err) {
      console.warn('Failed to save to localStorage:', err);
    }
  }, []);

  return (
    <ProductProfileContext.Provider
      value={{
        profile,
        selectedPlatform,
        setSelectedPlatform,
        loading,
        error,
        editableName,
        editableDescription,
        setEditableName,
        setEditableDescription,
        retry: fetchProfile,
      }}
    >
      {children}
    </ProductProfileContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProductProfile() {
  return useContext(ProductProfileContext);
}