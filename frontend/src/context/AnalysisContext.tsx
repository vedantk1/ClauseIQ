"use client";
import React, { createContext, useContext, useState } from "react";

interface Section {
  heading: string;
  text: string;
  summary?: string;
}

interface AnalysisCtx {
  sections: Section[];
  setSections: (sections: Section[]) => void;
  summary: string; // Added
  setSummary: (summary: string) => void; // Added
  fullText: string; // Added
  setFullText: (fullText: string) => void; // Added
  fileName: string; // Added
  setFileName: (fileName: string) => void; // Added
}

const Ctx = createContext<AnalysisCtx | undefined>(undefined);

export const AnalysisContext = Ctx; // Export the context for testing

export const AnalysisProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [sections, setSections] = useState<Section[]>([]);
  const [summary, setSummary] = useState<string>(""); // Added
  const [fullText, setFullText] = useState<string>(""); // Added
  const [fileName, setFileName] = useState<string>(""); // Added

  return (
    <Ctx.Provider
      value={{
        sections,
        setSections,
        summary, // Added
        setSummary, // Added
        fullText, // Added
        setFullText, // Added
        fileName, // Added
        setFileName, // Added
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
