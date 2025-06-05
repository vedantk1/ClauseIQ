"use client";
import React, { createContext, useContext, useState } from "react";
// Import shared types
import {
  Section,
  Clause,
  ClauseType,
  RiskLevel,
  RiskSummary,
} from "../../../shared/types/common";

// Define the Analysis context interface
interface AnalysisCtx {
  sections: Section[];
  setSections: (sections: Section[]) => void;
  summary: string;
  setSummary: (summary: string) => void;
  fullText: string;
  setFullText: (fullText: string) => void;
  fileName: string;
  setFileName: (fileName: string) => void;
  clauses: Clause[];
  setClauses: (clauses: Clause[]) => void;
  riskSummary: RiskSummary;
  setRiskSummary: (riskSummary: RiskSummary) => void;
  selectedClause: Clause | null;
  setSelectedClause: (clause: Clause | null) => void;
  documentId: string;
  setDocumentId: (id: string) => void;
}

const Ctx = createContext<AnalysisCtx | undefined>(undefined);

export const AnalysisContext = Ctx; // Export the context for testing

export const AnalysisProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [sections, setSections] = useState<Section[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [fullText, setFullText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [riskSummary, setRiskSummary] = useState<RiskSummary>({
    high: 0,
    medium: 0,
    low: 0,
  });
  const [selectedClause, setSelectedClause] = useState<Clause | null>(null);
  const [documentId, setDocumentId] = useState<string>("");

  return (
    <Ctx.Provider
      value={{
        sections,
        setSections,
        summary,
        setSummary,
        fullText,
        setFullText,
        fileName,
        setFileName,
        clauses,
        setClauses,
        riskSummary,
        setRiskSummary,
        selectedClause,
        setSelectedClause,
        documentId,
        setDocumentId,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useAnalysis = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAnalysis must be used within AnalysisProvider");
  return ctx;
};
