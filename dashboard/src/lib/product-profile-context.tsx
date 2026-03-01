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
  // Editable overrides stored in localStorage
  editableName: string;
  editableDescription: string;
  setEditableName: (n: string) => void;
  setEditableDescription: (d: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ProductProfileContext = createContext<ProductProfileContextValue>({
  profile: null,
  selectedPlatform: "all",
  setSelectedPlatform: () => {},
  loading: true,
  editableName: "Character.ai",
  editableDescription:
    "2,500 companion conversations analyzed across roleplay, emotional support, casual chat, and 6 other intents.",
  setEditableName: () => {},
  setEditableDescription: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ProductProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<ProductProfile | null>(null);
  const [loading, setLoading] = useState(true);
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
    } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/product-profile")
      .then((r) => r.json())
      .then(setProfile)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const setEditableName = useCallback((n: string) => {
    setEditableNameState(n);
    try { localStorage.setItem("convometrics_product_name", n); } catch {}
  }, []);

  const setEditableDescription = useCallback((d: string) => {
    setEditableDescriptionState(d);
    try { localStorage.setItem("convometrics_product_desc", d); } catch {}
  }, []);

  return (
    <ProductProfileContext.Provider
      value={{
        profile,
        selectedPlatform,
        setSelectedPlatform,
        loading,
        editableName,
        editableDescription,
        setEditableName,
        setEditableDescription,
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
