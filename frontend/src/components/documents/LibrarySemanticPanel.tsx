"use client";

import { useCallback, useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { indexAgreement, previewIndex, removeIndex, semanticStatus, type IndexPlan, type SemanticDocument, type SemanticStatus } from "@/lib/librarySemantic";
import styles from "./LibrarySearch.module.css";

const labels: Record<SemanticDocument["status"], string> = {
  not_indexed: "Not indexed", ready: "Ready", processing: "Indexing", interrupted: "Interrupted · outcome unknown",
  failed: "Attempt failed", stale: "Index outdated · rebuild needed", missing_vectors: "Index incomplete · reindex needed", unavailable: "No usable source text",
};

/** Mount/status/preview are unpaid. Only the confirmation dispatches embeddings. */
export function LibrarySemanticPanel() {
  const [status, setStatus] = useState<SemanticStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<IndexPlan | null>(null);
  const [removing, setRemoving] = useState<SemanticDocument | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try { setStatus(await semanticStatus()); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Index status is unavailable."); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function preview(id: string) {
    setBusy(true); setError(null); setNotice(null);
    try { setPlan(await previewIndex(id)); setRequestId(crypto.randomUUID()); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Preview failed."); }
    finally { setBusy(false); }
  }
  async function confirmIndex() {
    if (!plan || !requestId || busy) return;
    setBusy(true); setError(null);
    try {
      const result = await indexAgreement(plan, requestId);
      setNotice(result.status === "ready" ? "Semantic index ready." : "No new request was sent. Review the current index status.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Index outcome is unknown. Refresh status."); }
    finally { setPlan(null); setRequestId(null); await refresh(); setBusy(false); }
  }
  async function confirmRemove() {
    if (!removing || busy) return;
    setBusy(true); setError(null); setNotice(null);
    try { await removeIndex(removing); setNotice("Derived index removed. The PDF and saved review are unchanged."); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Index cleanup is not confirmed."); }
    finally { setRemoving(null); await refresh(); setBusy(false); }
  }

  return <div className={styles.semanticPanel}>
    <div className={styles.indexHeading}>
      <p>{status ? `${status.indexed_documents} of ${status.documents_in_library} agreements indexed` : "Loading index status…"}</p>
      <button type="button" disabled={busy} onClick={() => { setError(null); void refresh(); }}>Refresh status</button>
    </div>
    <details><summary>Manage semantic index</summary>
      <p className={styles.feedback}>Indexing sends eligible agreement text to OpenAI; rebuilding is another paid action. Semantic searches send your query. Both use your Settings key; Keyword stays free.</p>
      {status?.documents_not_examined ? <p className={styles.feedback}>{status.documents_not_examined} additional agreements were not examined in this bounded view.</p> : null}
      <ul className={styles.indexList} aria-label="Semantic index status">
        {status?.documents.map(document => <li key={document.document_id}>
          <div><strong>{document.filename}{status.documents.filter(item => item.filename === document.filename).length > 1 ? ` · ${document.document_id.slice(-6)}` : ""}</strong><p>{labels[document.status]}{document.partial ? " · Partial extracted text" : ""}</p>
            {document.failure && <p>{document.failure}</p>}</div>
          <div className={styles.indexActions}>
            {!["ready", "processing", "unavailable"].includes(document.status) && <button type="button" disabled={busy}
              onClick={() => void preview(document.document_id)}>Preview indexing</button>}
            {document.generation_id && document.status !== "processing" && document.status !== "not_indexed" && <button type="button" disabled={busy}
              onClick={() => setRemoving(document)}>Remove index</button>}
          </div>
        </li>)}
      </ul>
    </details>
    {notice && <p role="status" className={styles.feedback}>{notice}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <Modal isOpen={plan !== null} onClose={() => { if (!busy) { setPlan(null); setRequestId(null); } }} title="Index agreement for semantic search" size="md">
      {plan && <div className={styles.indexConfirmation}>
        <p>{plan.filename}</p>
        <p>{plan.passages} passages · {plan.input_tokens.toLocaleString()} input tokens · {plan.model}</p>
        <p>Estimated ${plan.estimated_usd}; request ceiling ${plan.maximum_usd}. This sends extracted text to OpenAI using your key.</p>
        {plan.excluded_headers > 0 && <p>{plan.excluded_headers} repeated headers excluded from retrieval; original text stays intact.</p>}
        {plan.partial && <p>Only available extracted text will be indexed. Missing pages are not covered.</p>}
        <p>No automatic retry. An interrupted attempt may still incur a charge. This creates search vectors, not a review or answer.</p>
        <div className={styles.indexActions}><button type="button" disabled={busy} onClick={() => setPlan(null)}>Cancel</button>
          <button type="button" disabled={busy} onClick={() => void confirmIndex()}>{busy ? "Indexing…" : "Index agreement · paid"}</button></div>
      </div>}
    </Modal>
    <Modal isOpen={removing !== null} onClose={() => { if (!busy) setRemoving(null); }} title="Remove semantic index" size="md">
      <div className={styles.indexConfirmation}><p>Remove derived search vectors for {removing?.filename}? Its original PDF and saved work stay unchanged. Indexing again is a separate paid action.</p>
        <div className={styles.indexActions}><button type="button" disabled={busy} onClick={() => setRemoving(null)}>Cancel</button>
          <button type="button" disabled={busy} onClick={() => void confirmRemove()}>{busy ? "Removing…" : "Remove index"}</button></div></div>
    </Modal>
  </div>;
}
