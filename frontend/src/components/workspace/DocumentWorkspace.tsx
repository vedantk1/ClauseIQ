"use client";

import React, { useEffect, useRef, useState } from "react";
import type { DocumentSourceResponse, ReviewEvidence, ReviewFinding } from "@clauseiq/shared-types";
import PDFViewer from "@/components/PDFViewer";
import { presentEvidence } from "./evidencePresentation";
import styles from "./DocumentWorkspace.module.css";

export interface DocumentWorkspaceProps {
  documentId: string;
  filename: string;
  source: DocumentSourceResponse | null;
  finding: ReviewFinding | null;
  evidence: ReviewEvidence | null;
  navigationRequest: { requestId: number; pageNumber: number; restore?: boolean } | undefined;
  onReturn: () => void;
  overviewText?: string;
  answerText?: string;
  returnLabel?: string;
}

/** Reading fills the workspace; review context and extraction are deliberate side trips. */
export function DocumentWorkspace({ documentId, filename, source, finding, evidence,
  navigationRequest, onReturn, overviewText, answerText, returnLabel }: DocumentWorkspaceProps) {
  const [pageNumber, setPageNumber] = useState(navigationRequest?.pageNumber || 1);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);
  const textToggle = useRef<HTMLButtonElement>(null);
  const textHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (showText) textHeading.current?.focus();
  }, [showText]);
  const closeText = () => {
    setShowText(false);
    textToggle.current?.focus();
  };
  const page = source?.source_extraction?.pages.find(item => item.page_number === pageNumber);
  const presentation = evidence ? presentEvidence(evidence, source) : null;
  // A default selected finding is not a source context for a direct Document-tab visit.
  const hasContext = !!(evidence || overviewText || answerText || returnLabel);
  const contextTitle = overviewText ? "Agreement overview" : answerText ? "Ask answer" : finding?.title || evidence?.label || "Agreement source";
  const backLabel = returnLabel || (overviewText ? "Return to overview" : "Return to this finding");

  const readerContext = hasContext ? <>
      <button type="button" className={styles.returnButton} onClick={onReturn}>← {backLabel}</button>
      {(evidence || overviewText || answerText || finding) && <details className={styles.context} onKeyDown={event => {
        if (event.key === "Escape" && event.currentTarget.open) {
          event.stopPropagation();
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}>
      <summary aria-label={evidence ? `Source reference · page ${evidence.page_number}` : "Review context"}>Context</summary>
      <div className={styles.contextBody}>
        <div className={styles.contextHeading}>
          <h2 className={styles.contextTitle}>{contextTitle}</h2>
          <button type="button" className={styles.closeButton} aria-label="Close review context" onClick={event => {
            const details = event.currentTarget.closest("details");
            if (details) {
              details.open = false;
              details.querySelector("summary")?.focus();
            }
          }}>×</button>
        </div>
        {answerText && <><p>{answerText}</p>
          <p className={styles.note}>A wording match is not legal verification. Ask references can differ from the finding’s.</p></>}
        {overviewText && <p>{overviewText}</p>}
        {finding && !overviewText && !answerText && <p>{finding.facts}</p>}
        {evidence && presentation && <>
          <p className={styles.contextLabel}>{evidence.label} · page {evidence.page_number}</p>
          <blockquote>{evidence.quote}</blockquote>
          <p className={presentation.matched === false ? styles.warning : styles.note}>{presentation.matchLabel}. {presentation.scope}; may begin or end mid-clause.</p>
          <p className={styles.note}>Physical page only. No guessed highlight is applied.</p>
        </>}
      </div>
      </details>}
    </> : undefined;

  return <section className={styles.workspace} aria-label="Document reader">
    {navigationError && <p role="alert" className={styles.navigationError}>{navigationError}</p>}
    <div className={`${styles.readingArea}${showText ? ` ${styles.withText}` : ""}`}>
      <div className={styles.pdfPane}>
        <PDFViewer key={`${documentId}:${source?.source_revision_id || "pending"}`} rememberView documentId={documentId} fileName={filename} sourceRevisionId={source?.source_revision_id || undefined}
          toolbarLeading={readerContext}
          toolbarActions={<button ref={textToggle} type="button" className={styles.textToggle} aria-expanded={showText} aria-controls="document-extracted-text"
            onClick={() => setShowText(value => !value)}>{showText ? "Hide extracted text" : "Extracted text"}</button>}
          navigationRequest={navigationRequest} onPageChange={page => { setPageNumber(page); setNavigationError(null); }}
          onNavigationError={setNavigationError} />
      </div>
      {showText && <aside className={styles.extraction} id="document-extracted-text" aria-label={`Extracted text on page ${pageNumber}`}
        onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); closeText(); } }}>
        <div className={styles.extractionHeading}><h3 ref={textHeading} tabIndex={-1}>Page {pageNumber} <span>Extracted text</span></h3>
          <button type="button" className={styles.closeButton} title="Close extracted text" aria-label="Close extracted text" onClick={closeText}>×</button>
        </div>
        <p className={styles.note}>Saved extraction output, not the PDF layout. Wording and reading order can differ.</p>
        <div className={styles.extractionText}>{page?.text || "No extracted text is available on this page."}</div>
      </aside>}
    </div>
  </section>;
}
