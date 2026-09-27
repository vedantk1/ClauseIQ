"use client";

import React, { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import type { DocumentSourceResponse, ReviewEvidence, ReviewFinding } from "@clauseiq/shared-types";
import { presentEvidence, type EvidencePresentation } from "./evidencePresentation";
import { Action } from "./WorkspaceControls";

function sameEvidenceReference(left: ReviewEvidence, right: ReviewEvidence) {
  return left.source_revision_id === right.source_revision_id && left.span_id === right.span_id &&
    left.end_span_id === right.end_span_id && left.page_number === right.page_number &&
    left.quote === right.quote && left.label === right.label;
}

function evidenceContextKey(evidence: ReviewEvidence) {
  return JSON.stringify([evidence.source_revision_id, evidence.page_number, evidence.span_id,
    evidence.end_span_id, evidence.quote, evidence.label]);
}

function SourceContext({ presentation }: { presentation: EvidencePresentation }) {
  const context = presentation.context;
  if (!context) return null;
  return <details className="cw-evidence-context">
    <summary>Inspect surrounding text · page {context.pageNumber}</summary>
    <p className="cw-evidence-context-note">Extracted source text, with the saved quotation marked. Surrounding text is not added to this citation and may not show a full clause; qualifications may be on other pages.</p>
    {context.clippedBefore && <p className="cw-evidence-context-boundary">Earlier text on this page is outside this window.</p>}
    <p className="cw-evidence-context-text whitespace-pre-wrap break-words">{context.before}<mark className="cw-evidence-context-match">{context.quote}</mark>{context.after}</p>
    {context.clippedAfter && <p className="cw-evidence-context-boundary">Later text on this page is outside this window.</p>}
    {(context.clippedBefore || context.clippedAfter) && <details className="cw-evidence-full-page">
      <summary>View full extracted page {context.pageNumber}</summary>
      <p className="cw-evidence-context-note">Extraction output, not a reproduction of the PDF layout.</p>
      <p className="cw-evidence-context-text whitespace-pre-wrap break-words">{context.fullPage}</p>
    </details>}
  </details>;
}

export function EvidenceSourcePane({ finding, source, onOpen, selectedEvidence, onSelect, heading = "Related evidence" }: {
  finding: ReviewFinding; source: DocumentSourceResponse | null; onOpen: (evidence: ReviewEvidence) => void;
  selectedEvidence?: ReviewEvidence | null; onSelect?: (evidence: ReviewEvidence) => void;
  heading?: string;
}) {
  const [localSelection, setLocalSelection] = useState<{ findingId: string; evidence: ReviewEvidence } | null>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<{ findingId: string; evidence: ReviewEvidence } | null>(null);
  const requested = selectedEvidence === undefined
    ? (localSelection?.findingId === finding.id ? localSelection.evidence : null)
    : selectedEvidence;
  // Only display an exact reference from this finding; stale selections never supply their own quote.
  const selected = finding.evidence.find(item => item === requested) ||
    (requested && finding.evidence.find(item => sameEvidenceReference(item, requested))) || finding.evidence[0] || null;
  useEffect(() => {
    const intent = pendingFocus.current;
    if (!intent) return; // Loading, resume and externally selected evidence never move focus.
    if (intent.findingId !== finding.id || !finding.evidence.includes(intent.evidence)) {
      pendingFocus.current = null;
      return;
    }
    if (selected !== intent.evidence) return; // A controlled selection must be displayed first.
    pendingFocus.current = null;
    detailHeading.current?.focus({ preventScroll: true });
    detailHeading.current?.scrollIntoView({ block: "nearest" });
  }, [finding.id, finding.evidence, selected, localSelection]);
  const presentation = selected ? presentEvidence(selected, source) : null;
  return <section className="cw-evidence-pane" aria-label={heading}>
    <h2 className="cw-evidence-heading">{heading}</h2>
    {selected && presentation ? <article className="cw-evidence-detail">
      <div className="cw-evidence-detail-topline">
        <h3 ref={detailHeading} tabIndex={-1} className="cw-evidence-detail-heading">{selected.label}</h3>
        <Action className="cw-evidence-open" disabled={!presentation.matched}
          title={presentation.matchLabel} onClick={() => { if (presentation.matched) onOpen(selected); }}>
          View page {selected.page_number}
        </Action>
      </div>
      <p className="cw-evidence-scope">{presentation.scope} · may begin or end mid-clause</p>
      <blockquote className="cw-evidence-quote whitespace-pre-wrap break-words">{selected.quote}</blockquote>
      {!presentation.matched && <p className="cw-evidence-match cw-evidence-match-warning" role="status">{presentation.matchLabel}</p>}
      <SourceContext key={`${finding.id}-${finding.evidence.indexOf(selected)}-${evidenceContextKey(selected)}`} presentation={presentation} />
    </article> : <p className="cw-evidence-empty">No source quotation accompanies this finding. Any not-found claim is limited to its stated reviewed scope, not proof that a term is absent.</p>}
    {finding.evidence.length > 1 && <h3 className="cw-evidence-references-heading">References ({finding.evidence.length})</h3>}
    {finding.evidence.length > 1 && <ul className="cw-evidence-list" aria-label="Evidence references">
      {finding.evidence.map((evidence, index) => <li className="cw-evidence-row" key={`${evidence.span_id}-${index}`}>
        <button type="button" className="cw-evidence-selector" aria-pressed={selected === evidence}
          aria-label={`Preview excerpt · ${evidence.label} · page ${evidence.page_number}`}
          title="Preview excerpt"
          onClick={() => {
            const intent = { findingId: finding.id, evidence };
            pendingFocus.current = intent;
            setLocalSelection(intent);
            onSelect?.(evidence);
          }}>
          <FileText className="cw-evidence-icon" size={19} aria-hidden="true" />
          <span className="cw-evidence-reference">
            <span className="cw-evidence-label">{evidence.label}</span>
            {!presentEvidence(evidence, source).matched && <span className="cw-evidence-unmatched">Source not matched</span>}
          </span>
        </button>
        <button type="button" className="cw-reference-open" aria-label={`View page ${evidence.page_number} · ${evidence.label}`}
          title={`Open original PDF at page ${evidence.page_number}`} disabled={!presentEvidence(evidence, source).matched}
          onClick={() => { if (presentEvidence(evidence, source).matched) onOpen(evidence); }}>View page {evidence.page_number}</button>
      </li>)}
    </ul>}
    <details className="cw-evidence-disclaimer">
      <summary>About source matching</summary>
      <p>A source match locates wording; it does not verify the interpretation. Read qualifications in context.</p>
    </details>
  </section>;
}

export function InlineEvidenceReference({ number, evidence, source, onOpen }: {
  number: number; evidence: ReviewEvidence; source: DocumentSourceResponse | null;
  onOpen: (evidence: ReviewEvidence) => void;
}) {
  const presentation = presentEvidence(evidence, source);
  return <button type="button" className="cw-inline-citation"
    aria-label={`Preview excerpt · source ${number} · page ${evidence.page_number} · ${evidence.label}${presentation.matched ? "" : " · source not matched"}`}
    title={`${evidence.label} · ${presentation.matchLabel}`} onClick={() => onOpen(evidence)}>
    Source {number}{!presentation.matched && <span className="cw-evidence-unmatched"> · not matched</span>}
  </button>;
}

export function EvidenceList({ evidence, source, onOpen, preview = false }: {
  evidence: ReviewEvidence[]; source: DocumentSourceResponse | null; onOpen: (evidence: ReviewEvidence) => void;
  preview?: boolean;
}) {
  if (preview) return <ul className="cw-ask-evidence-list" aria-label="Sources for this answer paragraph">
    {evidence.map((item, index) => {
      const presentation = presentEvidence(item, source);
      return <li key={`${item.span_id}-${index}`}>
        <button type="button" className="cw-ask-evidence-chip"
          aria-label={`Preview excerpt · page ${item.page_number} · ${item.label}`}
          title={`${item.label} · ${presentation.matchLabel}`}
          onClick={() => onOpen(item)}>
          <FileText size={14} aria-hidden="true" />
          <span>{item.label}</span><span className="cw-ask-evidence-page">p. {item.page_number}</span>
          {!presentation.matched && <span className="cw-evidence-unmatched">Source not matched</span>}
        </button>
      </li>;
    })}
  </ul>;
  return <div className="mt-4 space-y-4">
      {evidence.map((evidence, index) => {
        const presentation = presentEvidence(evidence, source);
        return <article className="rounded-lg border border-border-muted p-4" key={`${evidence.span_id}-${index}`}>
          <h3 className="font-medium">{evidence.label}</h3>
          <p className="mt-1 text-xs text-text-secondary">Page {evidence.page_number} · {presentation.matchLabel}</p>
          <p className="cw-evidence-scope">{presentation.scope} · may begin or end mid-clause</p>
          <blockquote className="my-3 whitespace-pre-wrap break-words border-l-2 border-accent-purple pl-3 text-sm leading-relaxed">{evidence.quote}</blockquote>
          <Action disabled={!presentation.matched} onClick={() => { if (presentation.matched) onOpen(evidence); }}>View page {evidence.page_number}</Action>
          <SourceContext key={evidenceContextKey(evidence)} presentation={presentation} />
        </article>;
      })}
    </div>;
}
