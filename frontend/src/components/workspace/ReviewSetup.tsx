import React from "react";
import { ArrowLeft, FileText } from "lucide-react";
import type { DocumentSourceResponse } from "@clauseiq/shared-types";
import { BriefForm, Action, Panel } from "./WorkspaceControls";
import { ReviewGenerationControls } from "./ReviewGenerationControls";
import { type ReviewWorkspaceController, type WorkspaceSaveState, sameBrief, paidActionBusy } from "./workspaceState";
import { reviewSetupSource } from "./reviewSetupState";
import styles from "./ReviewSetup.module.css";

export function ReviewSetup({ documentId, filename, source, sourceError, state, controller, onOriginal, onEarlierDocument, onSettings, onLibrary }: {
  documentId: string; filename: string; source: DocumentSourceResponse | null; sourceError: string | null;
  state: WorkspaceSaveState; controller: ReviewWorkspaceController;
  onOriginal: () => void; onEarlierDocument: () => void; onSettings: () => void; onLibrary: () => void;
}) {
  const workspace = state.workspace;
  if (!workspace) return null;
  const brief = state.briefDraft || workspace.brief;
  const dirty = !!state.briefDraft && !sameBrief(state.briefDraft, workspace.brief);
  const blocked = ["loading", "failed", "conflict", "review"].includes(state.status);
  const sourceState = reviewSetupSource(source, documentId, workspace.source_revision_id, sourceError);
  return <section className={styles.setup} aria-labelledby="review-setup-heading">
    <div className="cs-heading-row">
      <div className="cs-intro"><h2 id="review-setup-heading">Set up your review</h2>
        <p>Choose a perspective and the questions that matter to you.</p></div>
      <button type="button" className="cs-return" onClick={onLibrary}><ArrowLeft size={16} aria-hidden="true" />Return to Library</button>
    </div>
    <div className="cs-grid">
      <aside className="cs-source" aria-labelledby="setup-agreement-heading">
        <h3 id="setup-agreement-heading">Your agreement</h3>
        <div className="cs-file"><FileText size={25} aria-hidden="true" /><div><p>{filename}</p><span>{sourceState.pageCount === null ? "Page count unavailable" : `${sourceState.pageCount} ${sourceState.pageCount === 1 ? "page" : "pages"}`}</span></div></div>
        <div className="cs-source-status" data-limited={sourceState.limited || undefined} role="status">
          <h4>{sourceState.title}</h4>{(!sourceState.canReview || sourceState.limited) && <p>{sourceState.message}</p>}
          {source?.source_extraction && <p>{sourceState.extracted} of {sourceState.pageCount} pages have extracted text.</p>}
          {!!sourceState.missing.length && <p>Pages with missing text: {sourceState.missing.map(page => `${page.page_number} (${page.status === "empty" ? "no text" : "extraction failed"})`).join(", ")}. No OCR is performed.</p>}
        </div>
        <Action onClick={onOriginal} className="cs-original">View original</Action>
        {!sourceState.canReview && !!source && <button type="button" className="cs-text-action" onClick={onEarlierDocument}>Inspect saved document record</button>}
        <details className="cs-details"><summary>Source details</summary><dl><dt>Source revision</dt><dd>{workspace.source_revision_id}</dd><dt>SHA-256</dt><dd>{source?.source_sha256 || "Unavailable"}</dd><dt>Extractor</dt><dd>{source?.source_extraction?.extraction_version || "Unavailable"}</dd></dl></details>
        {workspace.fixture_available && <details className="cs-details cs-example"><summary>Try the synthetic example</summary><p>This PDF matches the supported synthetic agreement. Its authored customer-perspective findings are separate from AI output and do not use your brief.</p>
          <Action disabled={blocked || state.pending > 0 || paidActionBusy(state)} onClick={() => controller.createFixture()}>Load synthetic customer-perspective example</Action>
        </details>}
      </aside>
      <div className="cs-review">
        <BriefForm variant="setup" brief={brief} dirty={dirty} pending={blocked || state.pending > 0 || paidActionBusy(state)} onChange={value => controller.setBriefDraft(value)} onSave={() => controller.saveBrief()} />
        {state.status === "review" && dirty && <Panel><h3 className="font-semibold">Latest saved brief</h3><p className="mt-2 text-sm">{workspace.brief.role || workspace.brief.perspective}</p><p className="mt-2 whitespace-pre-wrap text-sm">{workspace.brief.priorities || "No priorities supplied."}</p><p className="mt-2 text-sm text-text-secondary">Your different local edits remain above. Applying pending changes may replace these saved values.</p></Panel>}
        <ReviewGenerationControls variant="setup" state={state} controller={controller} sourceReady={sourceState.canReview} onSettings={onSettings} />
      </div>
    </div>
  </section>;
}
