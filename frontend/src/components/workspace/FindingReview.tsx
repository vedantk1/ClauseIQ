"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { DocumentSourceResponse, ReviewEvidence, ReviewFinding, ReviewMarker, ReviewPersonalState, ReviewRun, SavedReviewQuestion } from "@clauseiq/shared-types";
import { Action, fieldClass, markerLabels } from "./WorkspaceControls";
import { EvidenceSourcePane } from "./EvidenceSourcePane";
import { FindingAsk } from "./FindingAsk";
import { draftKey, type ReviewWorkspaceController, type WorkspaceSaveState } from "./workspaceState";

interface FindingReviewProps {
  run: ReviewRun;
  finding: ReviewFinding;
  personal: ReviewPersonalState;
  state: WorkspaceSaveState;
  controller: ReviewWorkspaceController;
  source: DocumentSourceResponse | null;
  sourceReady: boolean;
  draft: string;
  savedQuestion?: SavedReviewQuestion;
  blocked: boolean;
  selectedEvidence: ReviewEvidence | null;
  showAsk: boolean;
  onFinding: (id: string) => void;
  onSelectEvidence: (evidence: ReviewEvidence) => void;
  onOpenEvidence: (evidence: ReviewEvidence) => void;
  onAskEvidence: (text: string, evidence: ReviewEvidence) => void;
  onShowAsk: () => void;
  onShowEvidence: () => void;
  onSettings: () => void;
}

/** Presentation only: saving, identity and paid requests remain controller-owned. */
export function FindingReview({ run, finding, personal, state, controller, source, sourceReady,
  draft, savedQuestion, blocked, selectedEvidence, showAsk, onFinding, onSelectEvidence,
  onOpenEvidence, onAskEvidence, onShowAsk, onShowEvidence, onSettings }: FindingReviewProps) {
  const [editing, setEditing] = useState(false);
  const [answerEvidence, setAnswerEvidence] = useState<{ text: string; evidence: ReviewEvidence } | null>(null);
  const questionEditor = useRef<HTMLTextAreaElement>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const readingPane = useRef<HTMLDivElement>(null);
  const companionPane = useRef<HTMLElement>(null);
  const index = run.findings.findIndex(item => item.id === finding.id);
  const questionUnchanged = !!savedQuestion && draft === savedQuestion.text;
  const questionConfirmed = questionUnchanged && state.status === "saved" && state.pending === 0;
  const questionStatus = state.status === "failed" ? "Save not confirmed. Keep this page open; your local draft remains here." :
    ["conflict", "review"].includes(state.status) ? "Pending changes need review before this question can be saved." :
    state.status === "loading" ? "Loading saved workspace state…" :
    state.status === "saving" || state.pending > 0 ? "Workspace changes are not yet confirmed. Keep this page open." :
    savedQuestion ? "Draft changed. Your last saved question is retained below." : "Local draft — save to add it to My review.";
  const answerCount = state.workspace?.ask_turns?.filter(turn => turn.run_id === run.id && turn.finding_id === finding.id).length || 0;
  useEffect(() => { if (editing && !showAsk) questionEditor.current?.focus(); }, [editing, showAsk]);
  useEffect(() => { if (readingPane.current) readingPane.current.scrollTop = 0; }, [run.id, finding.id]);
  useEffect(() => { if (companionPane.current) companionPane.current.scrollTop = 0; }, [run.id, finding.id, answerEvidence]);
  useEffect(() => { if (answerEvidence) companionPane.current?.focus({ preventScroll: true }); }, [answerEvidence]);

  return <div className="cw-findings-layout">
    <aside className="cw-findings-rail" aria-label="Finding navigation">
      <div className="cw-rail-heading"><h2>Findings</h2><span aria-label={`${run.findings.length} findings`}>{run.findings.length}</span></div>
      <p className="cw-muted cw-small">{run.kind === "fixture" ? "Examples · " : ""}Not exhaustive</p>
      <ol className="cw-finding-list">
        {run.findings.map((item, itemIndex) => <li key={item.id}>
          <button type="button" onClick={() => onFinding(item.id)} aria-current={finding.id === item.id ? "true" : undefined}>
            <span className="cw-finding-number" aria-hidden="true">{String(itemIndex + 1).padStart(2, "0")}</span>
            <span className="cw-finding-label"><span>{item.title}</span>
              {(personal.saved_questions[item.id] || (personal.markers[item.id] && personal.markers[item.id] !== "not_marked")) && <span className="cw-finding-meta">
                {personal.markers[item.id] && personal.markers[item.id] !== "not_marked" ? markerLabels[personal.markers[item.id]] : ""}
                {personal.saved_questions[item.id] && <>{personal.markers[item.id] && personal.markers[item.id] !== "not_marked" ? " · " : ""}Question saved</>}
              </span>}
              <span className="sr-only"> · {personal.opened_finding_ids.includes(item.id) ? "Opened" : "Not opened"}</span>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </li>)}
      </ol>
    </aside>

    <div className="cw-finding-center">
      <label className="cw-finding-picker">Finding <select value={finding.id} onChange={event => onFinding(event.target.value)}>
        {run.findings.map((item, i) => <option key={item.id} value={item.id}>{i + 1}. {item.title}</option>)}
      </select></label>
      <div className="cw-finding-tools">
        <div role="group" aria-label="Finding view" className="cw-view-switch">
          <button ref={reviewButton} type="button" aria-pressed={!showAsk} onClick={onShowEvidence}>Review</button>
          <button type="button" aria-pressed={showAsk} onClick={onShowAsk}>Ask{answerCount ? ` (${answerCount})` : ""}</button>
        </div>
        <label className="cw-status-label">Your status <select className="cw-marker" disabled={blocked} value={personal.markers[finding.id] || "not_marked"}
          onChange={event => controller.enqueue({ type: "set_marker", run_id: run.id, finding_id: finding.id, marker: event.target.value as ReviewMarker })}>
          {Object.entries(markerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <button type="button" className="cw-keep-action" onClick={() => { onShowEvidence(); setEditing(true); }}>
          {savedQuestion ? "Edit question" : "Keep question"}
        </button>
      </div>
    <div ref={readingPane} hidden={showAsk} className="cw-finding-body">
      <article className="cw-finding-reading" aria-labelledby="selected-finding-title">
        <div className="cw-finding-topline">
          <p className="cw-eyebrow">{run.kind === "fixture" ? "Example finding" : "AI finding"} {String(index + 1).padStart(2, "0")}</p>
        </div>
        <h2 id="selected-finding-title" className="cw-finding-title">{finding.title}</h2>
        <section className="cw-finding-section cw-facts"><h3>What the agreement says</h3><p>{finding.facts}</p></section>
        <section className="cw-finding-section"><h3>Why it matters</h3><p>{finding.interpretation}</p></section>
        <section className="cw-finding-section"><h3>Still unknown</h3><p>{finding.uncertainty}</p></section>
        {finding.basis === "not_found" && <section className="cw-finding-section"><h3>Not found within the reviewed scope</h3><p>{finding.coverage_basis || "No reviewed-scope explanation was supplied."}</p><p className="cw-muted">This is not proof of absence from the original, missing schedules or related documents.</p></section>}
        {finding.basis !== "not_found" && finding.coverage_basis && <section className="cw-finding-section"><h3>Reviewed scope</h3><p>{finding.coverage_basis}</p></section>}
        <section className="cw-finding-section cw-next-step"><h3>Possible next step</h3><p>{finding.next_step}</p></section>
        <details className="cw-finding-details"><summary>About your status</summary><p className="cw-muted cw-small">Your marker is not legal acceptance, a resolved issue or an AI judgement. Opening or saving does not set it.</p></details>
      </article>

      {!editing && savedQuestion && <section className="cw-saved-question-preview"><h3>Saved question</h3><p>{savedQuestion.text}</p><span className="cw-muted cw-small">{questionConfirmed ? "Saved in My review" : "Last confirmed wording · pending edits are not included"}</span></section>}
      <section hidden={!editing} className="cw-question" aria-labelledby="keep-question-heading">
        <h2 id="keep-question-heading">Question to keep</h2>
        <label className="sr-only" htmlFor="question-draft">Question draft for {finding.title}</label>
        <textarea ref={questionEditor} id="question-draft" className={fieldClass} rows={4} maxLength={5000} value={draft}
          onChange={event => controller.setDraft(run.id, finding.id, event.target.value)} onBlur={() => controller.flushDrafts()} placeholder="Write a question you want to keep…" />
        <div className="cw-question-actions">
          {questionConfirmed ? <span className="cw-question-saved" role="status">Saved in My review</span> :
            <Action className="cw-primary" disabled={blocked || !draft.trim() || questionUnchanged} onClick={() => controller.saveQuestion(run.id, finding.id, draft)}>{savedQuestion ? "Update saved question" : "Save question"}</Action>}
          <button type="button" className="cw-ask-action" onClick={() => { controller.flushDrafts(); setEditing(false); reviewButton.current?.focus(); }}>Close editor</button>
        </div>
        {!questionConfirmed && <p className="cw-muted cw-small" role="status">{questionStatus}</p>}
        {savedQuestion && draft !== savedQuestion.text && <blockquote className="cw-saved-wording">{savedQuestion.text}</blockquote>}
        {state.status === "review" && personal.drafts[finding.id] !== undefined && personal.drafts[finding.id] !== draft && <div className="cw-draft-conflict"><h3>Latest saved draft from the workspace</h3><p>{personal.drafts[finding.id] || "Empty draft"}</p><p>Your local wording remains above. Apply pending changes only after comparing both.</p></div>}
        <details className="cw-suggestion"><summary>{run.kind === "fixture" ? "Authored example suggestion" : "AI-suggested wording"}</summary><p>{finding.suggested_question}</p><Action onClick={() => controller.setDraft(run.id, finding.id, finding.suggested_question)}>{draft && draft !== finding.suggested_question ? "Replace draft with suggested wording" : "Use suggested wording"}</Action></details>
      </section>
    </div>

      <div hidden={!showAsk} className="cw-ask-content"><FindingAsk key={draftKey(run.id, finding.id)} run={run} finding={finding} state={state} controller={controller} source={source}
        reviewQuestion={draft.trim() ? draft : savedQuestion?.text || ""}
        sourceReady={sourceReady} onEvidence={(text, evidence) => setAnswerEvidence({ text, evidence })} onSettings={onSettings} /></div>
    </div>
    <aside ref={companionPane} tabIndex={-1} className="cw-companion" id="finding-companion" aria-label={showAsk && answerEvidence ? "Evidence for the selected answer" : "Evidence for the selected finding"}>
      {showAsk && answerEvidence ? <>
        <button type="button" className="cw-back-action" onClick={() => setAnswerEvidence(null)}>← Finding evidence</button>
        <p className="cw-muted cw-small">From the selected AI answer</p>
        <EvidenceSourcePane key={`answer-${answerEvidence.evidence.span_id}`} heading="Answer evidence"
          finding={{ ...finding, evidence: [answerEvidence.evidence] }} source={source}
          onOpen={item => onAskEvidence(answerEvidence.text, item)} />
      </> : <EvidenceSourcePane key={draftKey(run.id, finding.id)} finding={finding} source={source} selectedEvidence={selectedEvidence} onSelect={onSelectEvidence} onOpen={onOpenEvidence} />}
    </aside>
  </div>;
}
