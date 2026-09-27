import React from "react";
import Link from "next/link";
import { ArrowRight, FileText, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import type { DocumentItem, SortOption } from "@/types/documents";
import { formatContractType } from "@/utils/documentUtils";
import { hasCompletedAnalysis } from "@/lib/sourceStatus";
import Modal from "@/components/ui/Modal";
import styles from "./Library.module.css";
import { canOpenWorkspace, continuingDocument, documentDestination, duplicateIdentity, libraryDate, libraryDateTime, libraryReviewLabel, pageCountLabel, savedQuestionLabel, selectedLibraryDocument, sourceNotice } from "./libraryState";

function ExampleBadge({ document }: { document: DocumentItem }) {
  return document.review_summary?.kind === "fixture" ? <span className="cl-badge">Synthetic example</span> : null;
}

export function ContinueReviewing({ document }: { document: DocumentItem | null }) {
  if (!document) return null;
  return <section className="cl-continue" aria-labelledby="continue-heading">
    <div className="cl-resume-card">
      <FileText size={20} aria-hidden="true" className="cl-document-icon" />
      <div className="cl-resume-body">
        <h2 id="continue-heading">Continue reviewing</h2>
        <h3>{document.filename}</h3>
        {sourceNotice(document) && <p className="cl-warning">{sourceNotice(document)}</p>}
      </div>
      <Link className="cl-button" href={documentDestination(document, true)}>Resume review <ArrowRight size={18} aria-hidden="true" /></Link>
    </div>
  </section>;
}

export function AgreementInspector({ document, onDelete, deleting }: {
  document: DocumentItem | null; onDelete: (document: DocumentItem) => void; deleting: boolean;
}) {
  return <aside className="cl-inspector" id="agreement-inspector" aria-labelledby="inspector-heading">
    <h2 id="inspector-heading" className="cl-visually-hidden">Selected agreement</h2>
    {!document ? <p className="cl-muted">Select an agreement to see its details.</p> : <>
      <div className="cl-inspector-title"><FileText size={24} aria-hidden="true" className="cl-document-icon" />
        <div><h3>{document.filename}</h3><p>{pageCountLabel(document)}</p></div>
      </div>
      <dl className="cl-properties">
        <div><dt>Review</dt><dd>{libraryReviewLabel(document)}</dd></div>
        {document.review_summary?.kind && <div><dt>Review source</dt><dd>{document.review_summary.kind === "fixture" ? <ExampleBadge document={document} /> : "AI generated"}</dd></div>}
        <div><dt>Saved questions</dt><dd>{document.review_summary && document.review_summary.status !== "unavailable" ? savedQuestionLabel(document) : "Not available"}</dd></div>
        <div><dt>Imported</dt><dd>{libraryDateTime(document.upload_date)}</dd></div>
        <div><dt>Last review activity</dt><dd>{libraryDateTime(document.review_summary?.last_activity_at)}</dd></div>
        {document.contract_type && <div><dt>Contract type</dt><dd>{formatContractType(document.contract_type)}</dd></div>}
      </dl>
      {sourceNotice(document) && <p className="cl-source-notice">{sourceNotice(document)}. Check the original and source state in the document before relying on a review.</p>}
      {document.review_summary?.status === "unavailable" && <p className="cl-source-notice">Saved review metadata could not be read. Your stored work has not been changed.</p>}
      <div className="cl-inspector-actions">
        <Link className="cl-button" href={documentDestination(document)}>{canOpenWorkspace(document) ? "Open workspace" : "Open earlier review"}<ArrowRight size={18} aria-hidden="true" /></Link>
        {canOpenWorkspace(document) && hasCompletedAnalysis(document) && <Link className="cl-text-link" href={`/review?documentId=${encodeURIComponent(document.id)}`}>Earlier analysis &amp; original</Link>}
      </div>
      <button type="button" className="cl-delete" disabled={deleting} onClick={() => onDelete(document)}><Trash2 size={16} aria-hidden="true" />{deleting ? "Deleting…" : "Delete agreement"}</button>
    </>}
  </aside>;
}

export interface LibraryContentProps {
  searchPanel?: React.ReactNode;
  view?: "browse" | "search";
  onViewChange?: (view: "browse" | "search") => void;
  documents: DocumentItem[];
  filteredDocuments: DocumentItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  selectedId: string;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearch: (value: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  sortBy: SortOption;
  onSort: (value: SortOption) => void;
  contractType: string;
  contractTypes: string[];
  onContractType: (value: string) => void;
  isSelectMode: boolean;
  selectedDocuments: Set<string>;
  onToggleSelectMode: () => void;
  onToggleSelection: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onDeleteAll: () => void;
  onDelete: (document: DocumentItem) => void;
  busy: boolean;
}

export function LibraryContent(props: LibraryContentProps) {
  const { documents, filteredDocuments, loading, error, selectedId, onSelect, searchQuery, isSelectMode, selectedDocuments } = props;
  const hasSearch = props.searchPanel != null;
  const searching = hasSearch && props.view === "search";
  const selected = selectedLibraryDocument(filteredDocuments, selectedId);
  const recent = continuingDocument(documents);
  return <div className="cl-content">
    <section className="cl-intro" aria-labelledby="library-heading">
      <div><h1 id="library-heading">Library</h1><p>Your agreements and review notes.</p></div>
      <div className="cl-import-action"><Link href="/import" className="cl-button cl-primary"><Upload size={17} aria-hidden="true" />Import agreement</Link></div>
    </section>
    {loading ? <section className="cl-state" role="status"><h2>Loading your library…</h2><p>Reading saved agreements and review details.</p></section>
      : error ? <section className="cl-state" role="alert"><h2>Couldn’t load your library</h2><p>{error}</p><button type="button" className="cl-button" onClick={props.onRetry}>Retry</button></section>
      : documents.length === 0 ? <section className="cl-state"><FileText size={32} aria-hidden="true" /><h2>Your first agreement</h2><p>Import a PDF to start reading. No API key needed.</p></section>
      : <>
        {hasSearch && <div className="cl-view-toolbar">
          <div className="cl-view-switch" role="group" aria-label="Library view">
            <button type="button" aria-pressed={!searching} aria-controls="library-browse" onClick={() => props.onViewChange?.("browse")}>Browse</button>
            <button type="button" aria-pressed={searching} aria-controls="library-search" onClick={() => props.onViewChange?.("search")}>Search contract text</button>
          </div>
          <span className="cl-inventory-count">{documents.length} {documents.length === 1 ? "agreement" : "agreements"}</span>
        </div>}
        {hasSearch && <div id="library-search" hidden={!searching}>{props.searchPanel}</div>}
        <div id="library-browse" hidden={searching}>
        <ContinueReviewing document={recent} />
        <div className="cl-library-grid">
          <section className="cl-agreements" aria-labelledby="agreements-heading">
            <div className="cl-list-heading"><div><h2 id="agreements-heading">All agreements</h2>{(!hasSearch || filteredDocuments.length !== documents.length) && <p aria-live="polite">{filteredDocuments.length !== documents.length ? `${filteredDocuments.length} of ` : ""}{documents.length} {documents.length === 1 ? "agreement" : "agreements"}</p>}</div>
              <button type="button" onClick={props.onRetry} className="cl-icon-button" aria-label="Refresh library" title="Refresh library"><RefreshCw size={18} aria-hidden="true" /></button>
            </div>
            <div className="cl-toolbar">
            <div className="cl-search"><Search size={17} aria-hidden="true" /><input ref={props.searchInputRef} aria-label="Filter by filename" placeholder="Filter by filename" value={searchQuery} onChange={event => props.onSearch(event.target.value)} /></div>
            <div className="cl-list-tools">
              <label>Sort <select value={props.sortBy} onChange={event => props.onSort(event.target.value as SortOption)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name</option></select></label>
              {props.contractTypes.length > 0 && <label>Type <select value={props.contractType} onChange={event => props.onContractType(event.target.value)}><option value="">All types</option>{props.contractTypes.map(type => <option key={type} value={type}>{formatContractType(type)}</option>)}</select></label>}
              <details className="cl-menu cl-manage"><summary>Manage</summary><div className="cl-menu-items">
                <button type="button" onClick={props.onToggleSelectMode} disabled={props.busy}>{isSelectMode ? "Finish selection" : "Select agreements"}</button>
                <button type="button" onClick={props.onDeleteAll} disabled={props.busy}>Delete all agreements</button>
              </div></details>
            </div>
            </div>
            {isSelectMode && <div className="cl-selection-tools" aria-label="Bulk selection">
              <button type="button" onClick={props.onSelectAll} disabled={props.busy || !filteredDocuments.length}>Select all shown</button>
              <button type="button" onClick={props.onClearSelection} disabled={props.busy}>Clear selection</button>
              <button type="button" onClick={props.onDeleteSelected} disabled={props.busy || !selectedDocuments.size}>Delete selected ({selectedDocuments.size})</button>
              <button type="button" onClick={props.onToggleSelectMode} disabled={props.busy}>Done</button>
            </div>}
            {!filteredDocuments.length ? <div className="cl-state"><h3>No matching agreements</h3><p>Try another name or clear your filters.</p><button className="cl-button" type="button" onClick={() => { props.onSearch(""); props.onContractType(""); }}>Clear filters</button></div>
              : <>
                <div className="cl-column-headings" aria-hidden="true"><span>Agreement</span><span>Review</span><span>Last activity</span><span>Details</span></div>
                <ul className="cl-document-list" aria-label="Agreements">{filteredDocuments.map(document => <li key={document.id} className="cl-list-item">
                  {isSelectMode && <input className="cl-checkbox" type="checkbox" aria-label={`Select ${document.filename} for deletion`} checked={selectedDocuments.has(document.id)} disabled={props.busy} onChange={() => props.onToggleSelection(document.id)} />}
                  <div className="cl-document-row">
                    <Link href={documentDestination(document)} className="cl-document-name"><FileText size={22} aria-hidden="true" /><span><span className="cl-filename">{document.filename}</span><span className="cl-row-secondary">{pageCountLabel(document)}</span>{duplicateIdentity(document, documents) && <span className="cl-row-secondary">{duplicateIdentity(document, documents)}</span>}</span></Link>
                    <span className="cl-document-status"><span>{libraryReviewLabel(document)}</span>
                      {!!document.review_summary?.saved_question_count && <span className="cl-row-secondary">{savedQuestionLabel(document)}</span>}
                      {sourceNotice(document) && <span className="cl-row-secondary cl-warning">{sourceNotice(document)}</span>}
                    </span>
                    <span className="cl-imported" title={`Imported ${libraryDateTime(document.upload_date)}`}>{document.review_summary?.last_activity_at ? libraryDate(document.review_summary.last_activity_at) : <>Imported {libraryDate(document.upload_date)}</>}</span>
                    <button type="button" className="cl-details-button" aria-label={`Details for ${document.filename}${duplicateIdentity(document, documents) ? ` · ${document.id.slice(-6)}` : ""}`} aria-haspopup="dialog" onClick={() => onSelect(document.id)}>Details</button>
                  </div>
                </li>)}</ul>
              </>}
          </section>
        </div>
        </div>
          <Modal isOpen={!!selected} placement="right" size="md" title="Agreement details" onClose={() => onSelect("")}>
            <div className={`${styles.library} ${styles.detailsPanel}`}><AgreementInspector document={selected} onDelete={document => { onSelect(""); props.onDelete(document); }} deleting={props.busy} /></div>
          </Modal>
      </>}
  </div>;
}
