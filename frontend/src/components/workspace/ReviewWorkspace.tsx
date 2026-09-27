"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReviewEvidence, ReviewPosition } from "@clauseiq/shared-types";
import Modal from "@/components/ui/Modal";
import { useReviewWorkspace } from "@/hooks/useReviewWorkspace";
import { librarySourceTargetError, type ParsedLibrarySourceTarget } from "@/lib/librarySearch";
import { draftKey, emptyPersonal, hasUnconfirmedChanges, paidActionBusy, sameBrief, runLabel, runStatus, safeReviewPosition, libraryResumePosition } from "./workspaceState";
import { Action, BriefForm, Panel, SaveFeedback } from "./WorkspaceControls";
import { DocumentWorkspace } from "./DocumentWorkspace";
import { ReviewGenerationControls, ReviewRunSummary, ReviewRunDetails } from "./ReviewGenerationControls";
import { FindingReview } from "./FindingReview";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { ReviewSetup } from "./ReviewSetup";
import { SourceReadNotice } from "./SourceReadNotice";
import { AgreementOverview } from "./AgreementOverview";
import { MyReview } from "./MyReview";
import styles from "./ReviewWorkspace.module.css";

const viewNames: Record<ReviewPosition["view"], string> = {
  overview: "Overview", findings: "Findings", document: "Document", my_review: "My review",
};

export default function ReviewWorkspace({ documentId, resumeOnOpen = false, sourceTarget = { kind: "none" } }: {
  documentId: string; resumeOnOpen?: boolean; sourceTarget?: ParsedLibrarySourceTarget;
}) {
  const { controller, state, source, filename, sourceError, metadataError,
    sourceStatus, metadataStatus, retrySource, retryMetadata } = useReviewWorkspace(documentId);
  const router = useRouter();
  const [view, setView] = useState<ReviewPosition["view"]>("overview");
  const [selectedRun, setSelectedRun] = useState("");
  const [selectionRunId, setSelectionRunId] = useState("");
  const [selectedFinding, setSelectedFinding] = useState<string | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<string | null>(null);
  const [evidenceChoice, setEvidenceChoice] = useState<{ runId: string; findingId: string; index: number } | null>(null);
  const [overviewSource, setOverviewSource] = useState<{ runId: string; text: string; evidence: ReviewEvidence } | null>(null);
  const [askSource, setAskSource] = useState<{ runId: string; text: string; evidence: ReviewEvidence } | null>(null);
  const [askPanelTarget, setAskPanelTarget] = useState<{ runId: string; findingId: string } | null>(null);
  const [reviewSourceRunId, setReviewSourceRunId] = useState<string | null>(null);
  const [librarySourceActive, setLibrarySourceActive] = useState(false);
  const [sourceLinkError, setSourceLinkError] = useState<string | null>(null);
  const [navigationRequest, setNavigationRequest] = useState<{ runId: string; requestId: number; pageNumber: number; restore?: boolean }>();
  const [leaveWarning, setLeaveWarning] = useState(false);
  const [leaveDestination, setLeaveDestination] = useState("/documents");
  const workspace = state?.workspace;
  const resumed = useRef(false);
  const handledSourceTarget = useRef<string | null>(null);
  useEffect(() => {
    if (!resumeOnOpen || !workspace || resumed.current) return;
    resumed.current = true;
    const target = libraryResumePosition(workspace);
    if (!target) return;
    // Reopening is local UI restoration, not a save, generation or Ask request.
    setSelectedRun(target.runId);
    setSelectionRunId(target.runId);
    setView(target.position.view);
    setSelectedFinding(target.position.finding_id);
    setSelectedEvidence(target.position.evidence_span_id);
    if (target.pageNumber) setNavigationRequest({ runId: target.runId, requestId: 1, pageNumber: target.pageNumber, restore: true });
  }, [resumeOnOpen, workspace]);

  useEffect(() => {
    if (sourceTarget.kind === "none") {
      if (handledSourceTarget.current !== null) {
        handledSourceTarget.current = null;
        setLibrarySourceActive(false);
        setSourceLinkError(null);
      }
      return;
    }
    const key = sourceTarget.kind === "target"
      ? JSON.stringify([sourceTarget.target.sourceRevisionId, sourceTarget.target.pageNumber])
      : `invalid:${sourceTarget.message}`;
    if (handledSourceTarget.current === key) return;
    if (sourceTarget.kind === "invalid") {
      handledSourceTarget.current = key;
      setSourceLinkError(sourceTarget.message);
      return;
    }
    // Wait for both saved workspace and current source. A stale result must not
    // briefly navigate a remembered page before the source revision is checked.
    if (!workspace || sourceStatus !== "ready" || !source) return;
    handledSourceTarget.current = key;
    const issue = librarySourceTargetError(sourceTarget.target, source);
    if (issue) { setSourceLinkError(issue); return; }
    setSourceLinkError(null);
    setLibrarySourceActive(true);
    setReviewSourceRunId(null);
    setOverviewSource(null);
    setAskSource(null);
    setView("document");
    const activeRun = workspace.runs.find(item => item.id === selectedRun) || workspace.runs.at(-1);
    setNavigationRequest(previous => ({ runId: activeRun?.id || "", requestId: (previous?.requestId || 0) + 1,
      pageNumber: sourceTarget.target.pageNumber }));
  }, [sourceTarget, workspace, sourceStatus, source, selectedRun]);

  if (!state || !controller) return <p className="p-8" role="status">Loading review workspace…</p>;
  if (!workspace) return <div className="mx-auto max-w-3xl space-y-4 p-6">
    <h1 className="text-2xl font-semibold">Review workspace</h1>
    {sourceTarget.kind === "invalid" && <p role="alert" className="rounded-lg border border-border-muted p-3 text-sm">{sourceTarget.message}</p>}
    {state.status === "loading" ? <p role="status" className="text-sm text-text-secondary">Loading saved review workspace…</p>
      : <div role="alert" className="rounded-lg border border-border-muted p-3 text-sm">
        <p>The review workspace could not be loaded. {state.error}</p>
        <p className="mt-1 text-text-secondary">Retry reads saved review work. It does not start a review or send a question.</p>
        <Action className="mt-2" onClick={() => void controller.reloadSaved()}>Retry workspace loading</Action>
      </div>}
    <SourceReadNotice sourceStatus={sourceStatus} metadataStatus={metadataStatus}
      sourceError={sourceError} metadataError={metadataError}
      onRetrySource={retrySource} onRetryMetadata={retryMetadata} />
    {state.status !== "loading" && <p className="text-sm text-text-secondary">If this agreement was analyzed in the earlier workflow, its saved analysis remains available in the earlier review screen.</p>}
    <div className="flex gap-4"><Link className="underline" href="/documents">Document library</Link><Link className="underline" href={`/review?documentId=${encodeURIComponent(documentId)}`}>Earlier review</Link></div>
  </div>;

  const run = workspace.runs.find(item => item.id === selectedRun) || workspace.runs.at(-1) || null;
  const personal = run ? workspace.personal[run.id] || emptyPersonal() : emptyPersonal();
  const selectionBelongsToRun = run?.id === selectionRunId;
  const finding = (selectionBelongsToRun ? run?.findings.find(item => item.id === selectedFinding) : null) ||
    run?.findings.find(item => item.id === personal.position.finding_id) || run?.findings[0] || null;
  // A resume anchor is intentionally span-only. The live selector also needs the
  // exact immutable-run entry: two references can start at the same source span.
  const chosenEvidence = evidenceChoice?.runId === run?.id && evidenceChoice?.findingId === finding?.id
    ? finding?.evidence[evidenceChoice!.index] : null;
  const evidence = (selectionBelongsToRun ? chosenEvidence?.span_id === selectedEvidence ? chosenEvidence : finding?.evidence.find(item => item.span_id === selectedEvidence) : null) || null;
  const activeOverviewSource = overviewSource?.runId === run?.id ? overviewSource : null;
  const activeAskSource = askSource?.runId === run?.id ? askSource : null;
  const brief = state.briefDraft || workspace.brief;
  const briefDirty = !!state.briefDraft && !sameBrief(state.briefDraft, workspace.brief);
  const blocked = ["loading", "failed", "conflict", "review"].includes(state.status);
  const sourcePages = source?.source_extraction?.pages || [];
  const extractedPages = sourcePages.filter(page => page.status === "extracted").length;
  const saved = Object.entries(personal.saved_questions);
  const draft = finding && run ? state.localDrafts[draftKey(run.id, finding.id)] ?? personal.drafts[finding.id] ?? personal.saved_questions[finding.id]?.text ?? "" : "";
  const savedQuestion = finding ? personal.saved_questions[finding.id] : undefined;

  function navigate(nextView: ReviewPosition["view"], findingId = finding?.id || null, evidenceId = evidence?.span_id || null, sourceOpened = false) {
    setLibrarySourceActive(false);
    setReviewSourceRunId(null);
    setOverviewSource(null);
    setAskSource(null);
    setView(nextView);
    if (nextView === "document" && !sourceOpened) {
      setNavigationRequest(undefined);
      evidenceId = null; // A later Library resume must not revive the cleared citation.
    }
    const position = run ? safeReviewPosition(run, nextView, findingId, evidenceId) : null;
    setSelectionRunId(run?.id || "");
    setSelectedFinding(position?.finding_id || null);
    setSelectedEvidence(position?.evidence_span_id || null);
    if (run && position) controller!.enqueue({ type: "set_position", run_id: run.id, position });
  }

  function openEvidence(item: ReviewEvidence) {
    setNavigationRequest(previous => ({ runId: run?.id || "", requestId: (previous?.requestId || 0) + 1, pageNumber: item.page_number }));
    navigate("document", finding?.id || null, item.span_id, true);
    if (run && finding) setEvidenceChoice({ runId: run.id, findingId: finding.id, index: finding.evidence.indexOf(item) });
  }

  function selectEvidence(item: ReviewEvidence) {
    if (!run || !finding) return;
    navigate("findings", finding.id, item.span_id);
    setEvidenceChoice({ runId: run.id, findingId: finding.id, index: finding.evidence.indexOf(item) });
  }

  function openOverviewEvidence(text: string, item: ReviewEvidence) {
    setReviewSourceRunId(null);
    setAskSource(null);
    setOverviewSource({ runId: run?.id || "", text, evidence: item });
    setNavigationRequest(previous => ({ runId: run?.id || "", requestId: (previous?.requestId || 0) + 1, pageNumber: item.page_number }));
    setView("document");
    // Overview references are not finding-scoped resume positions.
  }

  function openAskEvidence(text: string, item: ReviewEvidence) {
    setReviewSourceRunId(null);
    setOverviewSource(null);
    setAskSource({ runId: run?.id || "", text, evidence: item });
    setNavigationRequest(previous => ({ runId: run?.id || "", requestId: (previous?.requestId || 0) + 1, pageNumber: item.page_number }));
    setView("document");
    // Ask may cite any supplied passage, not only the original finding's evidence.
    // Keep this transient: set_position permits finding evidence anchors only.
  }

  const openFinding = (findingId: string) => navigate("findings", findingId, null);
  function openMyReviewEvidence(findingId: string, item: ReviewEvidence) {
    const target = run?.findings.find(entry => entry.id === findingId);
    const index = target?.evidence.indexOf(item) ?? -1;
    if (!run || !target || index < 0) return;
    navigate("document", findingId, item.span_id, true);
    setEvidenceChoice({ runId: run.id, findingId, index });
    setNavigationRequest(previous => ({ runId: run.id, requestId: (previous?.requestId || 0) + 1, pageNumber: item.page_number }));
    setReviewSourceRunId(run.id);
  }
  function leave(destination: string) {
    if (hasUnconfirmedChanges(state!)) {
      controller!.flushDrafts(); setLeaveDestination(destination); setLeaveWarning(true);
    } else router.push(destination);
  }

  return <div className={styles.workspace}>
    <WorkspaceHeader documentId={documentId} filename={filename} run={run} state={state} onLeave={leave} />

    <div className="cw-notices">
    {sourceLinkError && <p className="cw-action-notice rounded-lg border border-border-muted p-3 text-sm" role="alert">{sourceLinkError}</p>}
    <SaveFeedback compact state={state} onReload={() => void controller.reloadSaved()} onRetry={() => controller.retryPending()} />
    {(state.askAction?.status !== undefined && state.askAction.status !== "idle" || workspace.ask_turns?.some(turn => turn.status === "processing")) && <div className="cw-action-notice rounded-lg border border-border-muted p-3 text-sm" role="status">
      <p>An Ask request is running or its outcome needs attention. Navigation and saving do not send another question.</p>
      <div className="mt-2 flex flex-wrap gap-2">{Array.from(new Map([
        ...(workspace.ask_turns || []).filter(turn => turn.status === "processing").map(turn => [JSON.stringify([turn.run_id, turn.finding_id]), { runId: turn.run_id, findingId: turn.finding_id }] as const),
        ...(state.askAction?.runId && state.askAction.findingId && state.askAction.status !== "idle" ? [["active", { runId: state.askAction.runId, findingId: state.askAction.findingId }] as const] : []),
      ]).values()).filter((target, index, all) => all.findIndex(item => item.runId === target.runId && item.findingId === target.findingId) === index).map(target => <Action key={`${target.runId}:${target.findingId}`} onClick={() => {
        setSelectedRun(target.runId); setSelectionRunId(target.runId); setSelectedFinding(target.findingId); setSelectedEvidence(null); setOverviewSource(null); setAskSource(null); setAskPanelTarget(target); setView("findings");
      }}>Open question and saved status</Action>)}</div>
    </div>}
    <SourceReadNotice sourceStatus={sourceStatus} metadataStatus={metadataStatus}
      sourceError={sourceError} metadataError={metadataError}
      onRetrySource={retrySource} onRetryMetadata={retryMetadata} />
    {run && <ReviewRunSummary compact includeDetails={false} run={run} contextChanged={!sameBrief(run.context, workspace.brief)} />}
    </div>

    <nav aria-label="Agreement workspace views" className="cw-tabs">
      {(Object.keys(viewNames) as ReviewPosition["view"][]).map(item => <button type="button" key={item} aria-current={view === item ? "page" : undefined}
        aria-label={item === "my_review" && saved.length > 0 ? `My review (${saved.length} saved ${saved.length === 1 ? "question" : "questions"})` : undefined}
        onClick={() => navigate(item)}>{item === "overview" && !run ? "Review setup" : viewNames[item]}{item === "my_review" && saved.length > 0 && <span className="cw-tab-count" aria-hidden="true">{saved.length}</span>}</button>)}
      {(run || workspace.runs.length > 1) && <div className="cw-run-tools">
      {run && <ReviewRunDetails run={run} />}
      {workspace.runs.length > 1 && <label className="cw-run-selector">Review run <select className="rounded border border-border-muted bg-bg-surface p-2" value={run?.id || ""} onChange={event => {
        setSelectedRun(event.target.value); setSelectionRunId(event.target.value); setSelectedFinding(null); setSelectedEvidence(null); setOverviewSource(null); setAskSource(null); setReviewSourceRunId(null); setView("overview");
      }}>{workspace.runs.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {runLabel(item)}{item.generation ? ` · ${item.generation.model_id}` : ""}</option>)}</select></label>}
      </div>}
    </nav>

    <div className={`cw-view cw-view-${view}`}>
    {view === "overview" && !run && <ReviewSetup documentId={documentId} filename={filename} source={source} sourceError={sourceError}
      state={state} controller={controller} onOriginal={() => navigate("document")}
      onEarlierDocument={() => leave(`/review?documentId=${encodeURIComponent(documentId)}`)}
      onSettings={() => leave("/settings")} onLibrary={() => leave("/documents")} />}
    {view === "overview" && run && <AgreementOverview run={run} personal={personal} source={source}
      sourceLoading={sourceStatus === "loading"} sourceError={sourceError}
      onFinding={openFinding} onSource={openOverviewEvidence} onOriginal={() => navigate("document")}
      onExplore={() => navigate("findings")} onMyReview={() => navigate("my_review")}
      controlsOpen={briefDirty || (state.reviewAction?.status || "idle") !== "idle" || workspace.runs.some(item => runStatus(item) === "processing")}>
      <BriefForm brief={brief} dirty={briefDirty} pending={blocked || state.pending > 0 || paidActionBusy(state)} onChange={value => controller.setBriefDraft(value)} onSave={() => controller.saveBrief()} />
        <ReviewGenerationControls state={state} controller={controller} sourceReady={!!source && source.source_revision_id === workspace.source_revision_id && extractedPages > 0 && !sourceError} onSettings={() => leave("/settings")} />
        {state.status === "review" && briefDirty && <Panel><h2 className="font-semibold">Latest saved brief</h2><p className="mt-2 text-sm">{workspace.brief.role || workspace.brief.perspective}</p><p className="mt-2 whitespace-pre-wrap text-sm">{workspace.brief.priorities || "No priorities supplied."}</p><p className="mt-2 text-xs text-text-secondary">Your different local edits remain in the form. Applying pending changes may replace these saved values.</p></Panel>}
        {!workspace.runs.some(item => item.kind === "fixture") && workspace.fixture_available && <Panel><p className="mb-3 text-sm text-text-secondary">This source matches the supported synthetic fixture. Load the labelled customer-perspective example to exercise saved work. Your brief is not used to generate it.</p><Action disabled={blocked || state.pending > 0 || paidActionBusy(state)} onClick={() => controller.createFixture()}>Load synthetic customer-perspective example</Action></Panel>}
    </AgreementOverview>}

    {view === "findings" && (run && finding ? <FindingReview key={draftKey(run.id, finding.id)} run={run} finding={finding} personal={personal} state={state} controller={controller}
      source={source} sourceReady={!!source && source.source_revision_id === run.source_revision_id && extractedPages > 0 && !sourceError}
      draft={draft} savedQuestion={savedQuestion} blocked={blocked} selectedEvidence={evidence}
      showAsk={askPanelTarget?.runId === run.id && askPanelTarget.findingId === finding.id}
      onFinding={openFinding} onSelectEvidence={selectEvidence} onOpenEvidence={openEvidence}
      onAskEvidence={openAskEvidence} onShowAsk={() => setAskPanelTarget({ runId: run.id, findingId: finding.id })}
      onShowEvidence={() => setAskPanelTarget(null)} onSettings={() => leave("/settings")} />
      : <Panel><h2 className="text-lg font-semibold">{run ? "No usable findings in this run" : "No review run yet"}</h2><p className="mt-2 text-sm">An empty finding list is not proof that the agreement has no issues. Check the run status and coverage on Overview.</p><Action className="mt-3" onClick={() => navigate("overview")}>Return to overview</Action></Panel>)}

    {view === "document" && <DocumentWorkspace documentId={documentId} filename={filename} source={source}
      finding={librarySourceActive || activeOverviewSource || activeAskSource || navigationRequest?.runId !== (run?.id || "") ? null : finding}
      evidence={activeOverviewSource?.evidence || activeAskSource?.evidence || (!librarySourceActive && navigationRequest?.runId === (run?.id || "") ? evidence : null)}
      overviewText={activeOverviewSource?.text} answerText={activeAskSource?.text} navigationRequest={navigationRequest?.runId === (run?.id || "") ? navigationRequest : undefined}
      returnLabel={librarySourceActive ? "Return to Library" : activeAskSource ? "Return to Ask" : reviewSourceRunId === run?.id ? "Return to My review" : undefined}
      onReturn={() => librarySourceActive ? leave("/documents?view=search") : navigate(activeOverviewSource ? "overview" : reviewSourceRunId === run?.id ? "my_review" : "findings")} />}

    {view === "my_review" && <MyReview key={run?.id || "no-run"} filename={filename} run={run} personal={personal} source={sourceError ? null : source} state={state} controller={controller}
      exportUnavailable={blocked || state.pending > 0 || state.status === "saving" || paidActionBusy(state)
        ? "Finish saving or resolve pending changes before exporting."
        : metadataStatus !== "ready" ? "Load the agreement details before exporting." : undefined}
      onFinding={openFinding} onSource={openMyReviewEvidence} onExplore={() => navigate(run ? "findings" : "overview")} />}

    </div>
    <Modal isOpen={leaveWarning} onClose={() => setLeaveWarning(false)} title="Some changes are not confirmed saved" footer={<><Action onClick={() => setLeaveWarning(false)}>Stay and finish saving</Action><Action onClick={() => router.push(leaveDestination)}>Leave without confirmed changes</Action></>}>
      <p>Confirmed saved work will remain. Local drafts, brief edits or pending changes may be lost when you leave. Return to the workspace to retry or resolve a conflict first.</p>
      {(["generating", "uncertain"].includes(state.reviewAction?.status) || ["generating", "uncertain"].includes(state.askAction?.status) || workspace.ask_turns?.some(turn => turn.status === "processing")) && <p className="mt-3">Leaving does not cancel an accepted AI request. Provider charges may still apply. Reopen this document to check its saved status; it will not automatically rerun.</p>}
    </Modal>
  </div>;
}
