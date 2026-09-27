"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { librarySearchHitHref, searchAgreementText, type LibrarySearchResult } from "@/lib/librarySearch";
import { searchSemantic } from "@/lib/librarySemantic";
import { LibrarySemanticPanel } from "./LibrarySemanticPanel";
import { LibraryAnswers } from "./LibraryAnswers";
import styles from "./LibrarySearch.module.css";

/** Keyword is unpaid; semantic queries require a deliberately labelled submit. */
export function LibrarySearch() {
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [result, setResult] = useState<LibrarySearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const requestId = useRef(0);
  const paidInFlight = useRef(false);
  const [mode, setMode] = useState<"keyword" | "semantic">("keyword");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (paidInFlight.current) return;
    const text = query.trim();
    requestId.current += 1;
    const currentRequest = requestId.current;
    setResult(null);
    setError(null);
    setSearchedQuery("");
    if (text.length < 2 || text.length > 200) {
      setSearching(false);
      setError("Enter between 2 and 200 characters to search agreement text.");
      return;
    }
    setSearching(true);
    if (mode === "semantic") paidInFlight.current = true;
    try {
      const next = mode === "keyword" ? await searchAgreementText(text) : await searchSemantic(text, crypto.randomUUID());
      if (currentRequest !== requestId.current) return;
      setResult(next);
      setSearchedQuery(text);
    } catch (failure) {
      if (currentRequest !== requestId.current) return;
      setError(failure instanceof Error ? failure.message : "Agreement text search failed.");
    } finally {
      paidInFlight.current = false;
      if (currentRequest === requestId.current) setSearching(false);
    }
  }

  function changeQuery(value: string) {
    requestId.current += 1; // A response to old wording must never replace newer input.
    setQuery(value);
    setResult(null);
    setSearchedQuery("");
    setError(null);
    setSearching(false);
  }

  const coverage = result?.coverage;
  const results = result && coverage ? <section className={styles.results} aria-label="Search passages" aria-live="polite">
    <div className={styles.resultHeading}>
      <div><p className={styles.eyebrow}>Source passages</p>
        <h3>{result.results.length ? `${result.results.length} ${result.results.length === 1 ? "passage" : "passages"} found` : "No matching passages"}</h3>
        <p className={styles.resultQuery}>For “{searchedQuery}”</p></div>
      <p className={styles.scope}>{coverage.scan_truncated
        ? `Scanned ${coverage.documents_scanned} of ${coverage.documents_in_library} agreements; ${coverage.documents_not_examined} were not examined.`
        : `Scanned ${coverage.documents_scanned} ${coverage.documents_scanned === 1 ? "agreement" : "agreements"}.`}</p>
    </div>
    {(coverage.documents_unsearchable > 0 || coverage.documents_partial > 0) && <p className={styles.coverageWarning}>
      {coverage.documents_unsearchable > 0 && `${coverage.documents_unsearchable} could not be searched. `}
      {coverage.documents_partial > 0 && `${coverage.documents_partial} had partial text.`}
    </p>}
    {(coverage.results_truncated || mode === "semantic") && <p className={styles.resultNote}>{mode === "keyword"
      ? "More matches exist. Refine your search to see them."
      : "Closest ranked passages—not exhaustive. A match does not guarantee relevance."}</p>}
    {result.results.length > 0 ? <ol className={styles.list} aria-label="Agreement text results">
      {result.results.map((hit, index) => {
        const href = librarySearchHitHref(hit);
        return <li key={`${hit.document_id}:${hit.source_revision_id}:${hit.passage_id}:${index}`} className={styles.hit}>
          <div className={styles.hitMeta}>
            <span className={styles.ordinal} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <p className={styles.filename}>{hit.filename}</p>
            {href ? <Link href={href}>View page {hit.page_number}</Link>
              : <span className={styles.unavailable}>Source link unavailable</span>}
          </div>
          {hit.source_incomplete && <p className={styles.coverageWarning}>Incomplete extraction · page {hit.page_number}</p>}
          <div className={styles.excerpt}><blockquote>{hit.excerpt}</blockquote>
            {hit.excerpt_partial && <p>Excerpt clipped from source passage</p>}</div>
        </li>;
      })}
    </ol> : <p className={styles.feedback}>Try a defined term or a shorter phrase. No answer has been generated.</p>}
  </section> : undefined;
  return <section className={styles.search} aria-labelledby="agreement-text-search-heading">
    <h2 id="agreement-text-search-heading" className={styles.srOnly}>Search agreement text</h2>
    <div className={styles.heading}>
      <div className={styles.modeChoices} role="group" aria-label="Search method">
        <button type="button" disabled={searching} aria-pressed={mode === "keyword"} onClick={() => { changeQuery(query); setMode("keyword"); }}>Keyword · free</button>
        <button type="button" disabled={searching} aria-pressed={mode === "semantic"} onClick={() => { changeQuery(query); setMode("semantic"); }}>Semantic · paid</button>
      </div>
      <details className={styles.searchHelp}><summary>How search works</summary>
        <p>Keyword search finds wording in saved text. Semantic search finds related passages in indexed agreements using OpenAI. Neither guarantees complete coverage. Generating an answer is a separate, confirmed paid action.</p>
      </details>
    </div>
    <form className={styles.form} onSubmit={event => void submit(event)} role="search" noValidate>
      <label className={styles.inputWrap}><Search size={17} aria-hidden="true" />
        <span className={styles.srOnly}>Search agreement text</span>
        <input type="search" value={query} onChange={event => changeQuery(event.target.value)} disabled={searching && mode === "semantic"}
          placeholder={mode === "keyword" ? "Clause, defined term or phrase" : "What do you want to find?"} minLength={2} maxLength={200} />
      </label>
      <button type="submit" disabled={searching}>{searching ? "Searching…" : mode === "keyword" ? "Search text" : "Search semantic · paid"}</button>
    </form>
    <p className={styles.sendNotice}>{mode === "keyword" ? "Local search · no AI call" : "Each search sends your query to OpenAI using your Settings key · paid"}</p>
    {mode === "semantic" && <LibrarySemanticPanel />}
    {searching && <p className={styles.feedback} role="status">{mode === "keyword" ? "Searching saved source text…" : "Searching current indexes…"}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    <LibraryAnswers contextId={result?.answer_context_id ?? null} results={results} />
  </section>;
}
