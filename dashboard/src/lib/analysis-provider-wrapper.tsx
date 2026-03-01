"use client";

import { ReactNode } from "react";
import { AnalysisProvider } from "./analysis-context";

export function AnalysisProviderWrapper({ children }: { children: ReactNode }) {
  return <AnalysisProvider>{children}</AnalysisProvider>;
}
