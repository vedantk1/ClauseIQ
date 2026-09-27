import React from "react";
import { ArrowRight, BookOpen, FileText } from "lucide-react";
import type { DocumentSourceResponse, ReviewEvidence, ReviewPersonalState, ReviewRun } from "@clauseiq/shared-types";
import { Action } from "./WorkspaceControls";
import { EvidenceList } from "./EvidenceSourcePane";
import { evidenceMatches, runStatus } from "./workspaceState";
import styles from "./WorkspaceSummaries.module.css";

export interface AgreementOverviewProps {
  run: ReviewRun;
  personal: ReviewPersonalState;
  source: DocumentSourceResponse | null;
  sourceLoading?: boolean;
  sourceError?: string | null;
  onFinding: (findingId: string) => void;
  onSource: (text: string, evidence: ReviewEvidence) => void;
  onOriginal: () => void;
  onExplore: () => void;
  onMyReview?: () => void;
  children?: React.ReactNode;
  controlsOpen?: boolean;
}

// Only the fixed generator disclaimer is routine. Unknown model-authored limits
// may describe missing material and must not be hidden by a text heuristic.
const ROUTINE_SOURCE_LIMITATION = "All successfully extracted text was supplied. Extraction and exact quote matches do not establish complete review, legal validity or correct interpretation.";

/** Saved agreement output leads; preparing another paid run stays secondary. */
export function AgreementOverview({ run, personal, source, sourceLoading = false, sourceError = null,
  onFinding, onSource, onOriginal, onExplore, onMyReview, children, controlsOpen = false,
}: AgreementOverviewProps) {
  const status = runStatus(run);
  const hasOutput = status === "ready" || status === "incomplete";
  const matchingSource = !sourceLoading && !sourceError && source?.source_revision_id === run.source_revision_id ? source : null;
  const extraction = matchingSource?.source_extraction;
  const pages = extraction?.pages || [];
  const extracted = pages.filter(page => page.status === "extracted").length;
  const missing = pages.filter(page => page.status !== "extracted");
  const findingIds = new Set(run.findings.map(finding => finding.id));
  const saved = Object.keys(personal.saved_questions).filter(id => findingIds.has(id));
  const opened = new Set(personal.opened_finding_ids.filter(id => findingIds.has(id))).size;
  const revisits = run.findings.filter(finding => personal.markers[finding.id] === "revisit");
  const materialLimitations = run.coverage?.limitations.filter(limitation => limitation !== ROUTINE_SOURCE_LIMITATION) || [];
  const routineLimitations = run.coverage?.limitations.filter(limitation => limitation === ROUTINE_SOURCE_LIMITATION) || [];
  const emptyMessage = status === "processing" ? "This review is still processing. No final agreement summary is available yet."
    : status === "failed" ? "No usable agreement summary was completed for this run. Your original and earlier saved runs remain available."
    : status === "interrupted" ? "This run was interrupted. No final agreement summary is available; it will not restart automatically."
    : "No usable overview is available in this run. Check its status and source limitations before using any findings.";

  return <div className={styles.summaries}>
    <header className="co-heading">
      <div><h2>Agreement summary</h2>{run.kind === "fixture" && <p className="co-example-label">Authored synthetic example</p>}</div>
      <Action className="co-secondary-action" onClick={onOriginal}><FileText size={17} aria-hidden="true" />Open original</Action>
    </header>

      <section className="co-agreement-summary" aria-label="Agreement summary">
        {hasOutput && run.overview_items?.length ? <div className="co-summary-items">{run.overview_items.map((item, index) => <article className="co-summary-item" key={index}>
          <p className="co-reading">{item.text}</p>
          {item.evidence.length > 0 ? <details className="co-overview-evidence"><summary>{item.evidence.length} source {item.evidence.length === 1 ? "reference" : "references"}</summary>
            <EvidenceList evidence={item.evidence} source={matchingSource} onOpen={evidence => {
              if (evidence.source_revision_id === run.source_revision_id && evidenceMatches(evidence, matchingSource)) onSource(item.text, evidence);
            }} />
          </details> : <p className="co-no-reference">No source reference saved.</p>}
        </article>)}</div> : <p className="co-reading">{hasOutput && run.overview ? run.overview : emptyMessage}</p>}
        <div className="co-findings-next" role="group" aria-label="Review next actions">
          {hasOutput ? <>
            <Action className="co-primary-action" onClick={onExplore}>Explore findings<span className="co-action-count">{run.findings.length}</span><ArrowRight size={17} aria-hidden="true" /></Action>
            {onMyReview && <Action className="co-secondary-action" onClick={onMyReview}><BookOpen size={16} aria-hidden="true" />My review{saved.length > 0 && <span className="co-action-count">{saved.length} saved</span>}</Action>}
          </> : <p>A missing result is not a finding that the agreement has no issues.</p>}
        </div>
      </section>

    {revisits.length > 0 && <details className="co-revisit"><summary>Revisit later <span>{revisits.length}</span></summary><ul>{revisits.map(finding => <li key={finding.id}><button type="button" onClick={() => onFinding(finding.id)}>{finding.title}<ArrowRight size={15} aria-hidden="true" /></button></li>)}</ul></details>}

    <section className="co-source-coverage" aria-label="Source and coverage">
      {sourceLoading ? <p role="status">Loading source details…</p>
        : sourceError ? <p role="alert">Source details could not be loaded. Use the source recovery controls above to retry; saved review work remains unchanged.</p>
        : !matchingSource ? <p role="alert">Source details are unavailable or do not match this run. Evidence cannot be checked against them.</p>
        : !extraction ? <p>No page-aware source snapshot is available. The original PDF and extraction status are separate from the review.</p>
        : null}
      {missing.length > 0 && <p className="co-limitation">Extraction limitations on pages {missing.map(page => `${page.page_number} (${page.status === "empty" ? "no extractable text" : "extraction failed"})`).join(", ")}. No OCR is performed.</p>}
      {!!run.coverage?.omitted_pages.length && <p className="co-limitation">Pages omitted from this review: {run.coverage.omitted_pages.join(", ")}.</p>}
      {materialLimitations.length > 0 && <ul className="co-limitations">{materialLimitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul>}
      <details className="co-source-details"><summary>Source coverage and review details</summary>
        {extraction && <p>{extracted} of {extraction.page_count} source pages have extracted text.</p>}
        {run.coverage && <><p>Saved run input: {run.coverage.extracted_pages.length} of {run.coverage.page_count} pages.</p><p>Pages supplied: {run.coverage.extracted_pages.join(", ") || "None"}.</p></>}
        {routineLimitations.length > 0 && <ul className="co-limitations">{routineLimitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul>}
        <p>Findings are not a complete inventory of the agreement’s risks. Text supplied is not proof that every provision was understood.</p>
        <p>{saved.length} saved {saved.length === 1 ? "question" : "questions"} · {revisits.length} to revisit · {opened} findings opened. Personal activity, not review completeness.</p>
        <dl><dt>Source revision</dt><dd>{run.source_revision_id}</dd><dt>SHA-256</dt><dd>{matchingSource?.source_sha256 || "Unavailable"}</dd><dt>Extractor</dt><dd>{extraction?.extraction_version || "Unavailable"}</dd></dl>
      </details>
    </section>

    {children && <details className="co-review-controls" open={controlsOpen}>
      <summary>Review instructions &amp; new review</summary>
      <p className="co-controls-note">Changing instructions does not update these saved findings.</p><div className="co-review-controls-content">{children}</div>
    </details>}
  </div>;
}
