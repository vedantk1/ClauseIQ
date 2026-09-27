"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import { librarySearchHitHref } from "@/lib/librarySearch";
import { interruptLibraryAnswer, previewLibraryAnswer, readLibraryAnswer, recentLibraryAnswers,
  startLibraryAnswer, statementEvidence, type AnswerEvidence, type AnswerPlan, type AnswerSummary,
  type LibraryAnswer } from "@/lib/libraryAnswers";
import styles from "./LibraryAnswers.module.css";

const outcomeLabels = { answered: "Answer from selected passages", partial: "Partial answer", insufficient_evidence: "Insufficient evidence" };
const statusLabels = { processing: "Processing", completed: "Saved", interrupted: "Interrupted · outcome unknown",
  failed: "Output withheld", failed_or_unknown: "Failed · charges may apply", source_unavailable: "Source unavailable" };
const agreementLabel = (count: number) => `${count} ${count === 1 ? "agreement" : "agreements"}`;

function Excerpt({ item }: { item: AnswerEvidence }) {
  const href = librarySearchHitHref({ ...item, excerpt: item.quote, excerpt_partial: false });
  return <details className={styles.answerEvidence}>
    <summary>Preview excerpt · {item.filename} · page {item.page_number}</summary>
    <blockquote>{item.quote}</blockquote>
    {(item.continuation_before || item.continuation_after) && <p>Surrounding passages may contain qualifications.</p>}
    {item.source_incomplete && <p>This document has incomplete extracted text.</p>}
    {href ? <Link href={href}>View page {item.page_number}</Link> : <p>Source link unavailable.</p>}
    <p className={styles.evidenceMeta}>Reference {item.id} · passage {item.passage_id}</p>
  </details>;
}

/** All effects/readbacks are unpaid. Only an explicit modal confirmation sends. */
export function LibraryAnswers({ contextId, results }: { contextId: string | null; results?: ReactNode }) {
  const [plan, setPlan] = useState<AnswerPlan | null>(null);
  const [answer, setAnswer] = useState<LibraryAnswer | null>(null);
  const [recent, setRecent] = useState<AnswerSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interrupting, setInterrupting] = useState(false);
  const inFlight = useRef(false);
  const plannedId = useRef<string | null>(null);
  const previewSequence = useRef(0);
  const currentContext = useRef(contextId);
  currentContext.current = contextId;
  const readSequence = useRef(0);

  const refresh = useCallback(async () => {
    try { setRecent(await recentLibraryAnswers()); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Saved answers unavailable."); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { if (!inFlight.current) setPlan(null); }, [contextId]);

  async function preview() {
    if (!contextId || inFlight.current) return;
    const sequence = ++previewSequence.current;
    const target = contextId;
    setBusy(true); setError(null);
    try {
      const next = await previewLibraryAnswer(target);
      if (sequence !== previewSequence.current || currentContext.current !== target) return;
      setPlan(next); plannedId.current = crypto.randomUUID();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Preview failed."); }
    finally { if (sequence === previewSequence.current) setBusy(false); }
  }
  async function confirm() {
    if (!plan || !plannedId.current || inFlight.current || plan.context_id !== currentContext.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    ++readSequence.current;
    try { setAnswer(await startLibraryAnswer(plan, plannedId.current)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Outcome unknown. Refresh saved answers; do not resend automatically."); }
    finally { setPlan(null); plannedId.current = null; await refresh(); inFlight.current = false; setBusy(false); }
  }
  async function open(id: string) {
    if (inFlight.current) return;
    const sequence = ++readSequence.current;
    setBusy(true); setError(null);
    try { const saved = await readLibraryAnswer(id); if (sequence === readSequence.current) setAnswer(saved); }
    catch (failure) { if (sequence === readSequence.current) setError(failure instanceof Error ? failure.message : "Saved status unavailable."); }
    finally { if (sequence === readSequence.current) setBusy(false); }
  }
  async function markInterrupted() {
    if (!answer || inFlight.current) return;
    setBusy(true); setError(null);
    try { setAnswer(await interruptLibraryAnswer(answer.request_id)); await refresh(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Interruption was not saved."); }
    finally { setInterrupting(false); setBusy(false); }
  }

  const belongsToCurrentSearch = !!answer && answer.context_id === contextId;
  const outcome = answer?.status === "completed" ? answer.outcome : null;
  const combined = belongsToCurrentSearch && results != null;

  return <div className={styles.answers} aria-label="Library answers" aria-busy={busy}>
    <div className={styles.toolbar}>
      {contextId && <div className={styles.createAnswer}>
        <button className={styles.primaryAction} type="button" disabled={busy} onClick={() => void preview()}>Answer from these results</button>
        <span>Preview first · paid on confirmation</span>
      </div>}
      <details className={styles.answerHistory}><summary>Saved Library answers{recent.length ? ` (${recent.length})` : ""}</summary>
        <div className={styles.historyContent}>
        <button type="button" disabled={busy} onClick={() => void refresh()}>Refresh saved status</button>
        {!recent.length && <p>No saved answer attempts yet.</p>}
        <ul>{recent.map(item => <li key={item.request_id}><button type="button" disabled={busy} onClick={() => void open(item.request_id)}>
          {item.question || "Removed source content"} <span>· {statusLabels[item.status]}</span>
        </button></li>)}</ul>
        {recent.length === 20 && <p>Showing the 20 most recent attempts.</p>}
        </div>
      </details>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {busy && <p role="status" className={styles.feedback}>{inFlight.current ? "Generating answer…" : "Loading answer…"}</p>}
    <div className={combined ? styles.combined : styles.stacked} data-layout={combined ? "answer-and-results" : "stacked"}>
    {answer && <article className={styles.answer} aria-label="Saved Library answer"
      data-status={outcome || answer.status} data-search-context={belongsToCurrentSearch ? "current" : "earlier"}>
      <div className={styles.answerHeading}><p className={styles.eyebrow}>Saved answer · {belongsToCurrentSearch ? "this search" : "earlier search"}</p>
        <button type="button" disabled={busy} onClick={() => setAnswer(null)}>Close answer</button></div>
      <h3 className={styles.outcome}>{outcome ? outcomeLabels[outcome] : statusLabels[answer.status]}</h3>
      {answer.question && <p className={styles.answerQuestion}>{answer.question}</p>}
      {!belongsToCurrentSearch && <p className={styles.feedback}>{results != null
        ? "This saved answer uses earlier search results, not the results shown below."
        : "This saved answer uses an earlier search."}</p>}
      {answer.failure && <p role="status" className={styles.feedback}>{answer.failure}</p>}
      {answer.status === "completed" && <>
        {!!answer.limitations.length && <div className={styles.answerLimitations}><h4>{outcome === "insufficient_evidence" ? "What is missing" : "Gaps and qualifications"}</h4>
          <ul>{answer.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
        {answer.statements.map((statement, index) => {
          const sources = statementEvidence(answer, statement.evidence_ids);
          return <section className={styles.answerStatement} key={index}>
            {sources ? <><p>{statement.text}</p>{sources.map(item => <Excerpt key={item.id} item={item} />)}</>
              : <p role="alert">This statement has an unavailable reference and was withheld.</p>}
          </section>;
        })}
        <p className={styles.scope}>{answer.evidence.length} selected {answer.evidence.length === 1 ? "passage" : "passages"} · {agreementLabel(new Set(answer.evidence.map(item => item.document_id)).size)}. This is not a complete review of every agreement.</p>
      </>}
      {answer.status === "processing" && <div className={styles.actions}>
        <button type="button" disabled={busy} onClick={() => void open(answer.request_id)}>Refresh this attempt</button>
        <button type="button" disabled={busy} onClick={() => setInterrupting(true)}>Mark interrupted</button>
      </div>}
      {answer.generation && <details className={styles.feedback}><summary>Generation and search details</summary>
        <p>{answer.generation.model_id} · {answer.generation.reasoning_effort} reasoning · {answer.method} search</p>
        <p>Scan: {answer.coverage.documents_scanned}/{answer.coverage.documents_in_library} agreements · {answer.coverage.documents_unsearchable} unavailable · {answer.coverage.documents_partial} partial.</p>
        <p>Prompt {answer.generation.prompt_version} · {answer.generation.duration_ms ?? "Unknown"} ms · usage {answer.generation.usage?.total_tokens ?? "unknown"} tokens.</p>
        <p>Source links locate preserved wording; they do not verify the interpretation.</p>
      </details>}
    </article>}
    {results != null && <div className={styles.resultCompanion}>{results}</div>}
    </div>
    <Modal isOpen={plan !== null} onClose={() => { if (!inFlight.current) setPlan(null); }} title="Answer from these results" size="lg">
      {plan && <div className={styles.confirmation}>
        <p className={styles.confirmationQuestion}>{plan.question}</p>
        <p className={styles.feedback}>{plan.evidence.length} {plan.evidence.length === 1 ? "passage" : "passages"} from {agreementLabel(new Set(plan.evidence.map(item => item.document_id)).size)} · {plan.method} results</p>
        <p>Sends this question and these complete passages to OpenAI using your Settings key. Charges apply. No new search or automatic retry.</p>
        {(plan.coverage.documents_not_examined > 0 || plan.coverage.documents_unsearchable > 0 || plan.coverage.documents_partial > 0) && <p className={styles.sourceWarning}>
          {[
            plan.coverage.documents_not_examined > 0 && `${agreementLabel(plan.coverage.documents_not_examined)} not examined`,
            plan.coverage.documents_unsearchable > 0 && `${agreementLabel(plan.coverage.documents_unsearchable)} unavailable`,
            plan.coverage.documents_partial > 0 && `${agreementLabel(plan.coverage.documents_partial)} with partial text`,
          ].filter(Boolean).join(" · ")}
        </p>}
        <details className={styles.feedback}><summary>Model, usage and search coverage</summary>
          <p>{plan.generation.model_id} · {plan.generation.reasoning_effort} reasoning · approximately {plan.generation.estimated_input_tokens.toLocaleString()} input tokens · up to {plan.generation.max_completion_tokens.toLocaleString()} output/reasoning tokens.</p>
          <p>The search examined {plan.coverage.documents_scanned}/{plan.coverage.documents_in_library} agreements. Selected passages can miss relevant terms.</p>
        </details>
        <details><summary>Inspect evidence being sent</summary>{plan.evidence.map(item => <Excerpt key={item.id} item={item} />)}</details>
        <div className={styles.actions}><button type="button" disabled={busy} onClick={() => setPlan(null)}>Cancel</button>
          <button className={styles.primaryAction} type="button" disabled={busy || plan.context_id !== contextId} onClick={() => void confirm()}>{busy ? "Generating answer…" : "Generate answer · paid"}</button></div>
      </div>}
    </Modal>
    <Modal isOpen={interrupting} onClose={() => { if (!busy) setInterrupting(false); }} title="Mark answer interrupted" size="md">
      <div className={styles.confirmation}><p>This does not cancel provider work or prove that no charge occurred. A late answer will not overwrite this status. No request is sent again.</p>
        <div className={styles.actions}><button type="button" disabled={busy} onClick={() => setInterrupting(false)}>Cancel</button>
          <button type="button" disabled={busy} onClick={() => void markInterrupted()}>Mark interrupted</button></div></div>
    </Modal>
  </div>;
}
