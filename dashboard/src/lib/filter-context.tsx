"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface Filters {
  intents: string[];
  sentiment: string | null;
  resolution: string | null;
}

interface FilterContextValue {
  filters: Filters;
  setIntents: (intents: string[]) => void;
  setSentiment: (s: string | null) => void;
  setResolution: (r: string | null) => void;
  clearAll: () => void;
  hasActiveFilters: boolean;
}

const DEFAULT_FILTERS: Filters = { intents: [], sentiment: null, resolution: null };

const FilterContext = createContext<FilterContextValue>({
  filters: DEFAULT_FILTERS,
  setIntents: () => {},
  setSentiment: () => {},
  setResolution: () => {},
  clearAll: () => {},
  hasActiveFilters: false,
});

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const setIntents = useCallback((intents: string[]) => {
    setFilters((f) => ({ ...f, intents }));
  }, []);

  const setSentiment = useCallback((sentiment: string | null) => {
    setFilters((f) => ({ ...f, sentiment }));
  }, []);

  const setResolution = useCallback((resolution: string | null) => {
    setFilters((f) => ({ ...f, resolution }));
  }, []);

  const clearAll = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const hasActiveFilters = filters.intents.length > 0 || filters.sentiment !== null || filters.resolution !== null;

  return (
    <FilterContext.Provider value={{ filters, setIntents, setSentiment, setResolution, clearAll, hasActiveFilters }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  return useContext(FilterContext);
}
