"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, FileText, LoaderCircle, Upload, X } from "lucide-react";
import config from "@/config/config";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { importSource, SourceImportError } from "@/lib/sourceImport";
import { LibraryHeader } from "./LibraryHeader";
import { importedWorkspaceDestination, importFileSize, savedImportDestination, validateImportFiles } from "./importState";
import libraryStyles from "./Library.module.css";
import styles from "./ImportAgreement.module.css";

type ImportFailure = { message: string; documentId?: string };

export default function ImportAgreement() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const importing = useRef(false);
  const recoveryRequired = useRef(false);
  const mounted = useRef(true);
  const leaving = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  const [failure, setFailure] = useState<ImportFailure | null>(null);
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function selectFiles(files: readonly File[]) {
    if (importing.current || !files.length) return;
    const error = validateImportFiles(files, config.maxFileSizeMB);
    setValidation(error);
    if (error) {
      // A rejected replacement must not leave an older file ready to import.
      setFile(null);
      return;
    }
    setFile(files[0]);
    recoveryRequired.current = false;
    setFailure(null);
  }

  function removeFile() {
    if (importing.current) return;
    setFile(null);
    recoveryRequired.current = false;
    setValidation(null);
    setFailure(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function navigate(nextDestination: string) {
    if (file || importing.current) setDestination(nextDestination);
    else router.push(nextDestination);
  }

  function leavePage() {
    if (!destination) return;
    // The server may finish saving after navigation. Never redirect back from a stale request.
    leaving.current = true;
    router.push(destination);
    setDestination(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || importing.current || recoveryRequired.current) return;
    const error = validateImportFiles([file], config.maxFileSizeMB);
    setValidation(error);
    if (error) return;
    importing.current = true;
    setPending(true);
    setFailure(null);
    let completed = false;
    let documentId: string | undefined;
    try {
      const source = await importSource(file);
      documentId = source.id;
      if (!mounted.current || leaving.current) return;
      router.push(importedWorkspaceDestination(source.id));
      // Keep the submit lock until navigation completes, avoiding duplicate imports.
      completed = true;
    } catch (cause) {
      if (!mounted.current || leaving.current) return;
      recoveryRequired.current = true;
      setFailure({
        message: cause instanceof Error ? cause.message : "The import could not be confirmed.",
        documentId: cause instanceof SourceImportError ? cause.documentId : documentId,
      });
    } finally {
      if (!completed && mounted.current && !leaving.current) {
        importing.current = false;
        setPending(false);
      }
    }
  }

  return <div className={libraryStyles.library}>
    <LibraryHeader current="import" onNavigate={navigate} />
    <section className={styles.content} aria-labelledby="import-title">
      <button type="button" className={styles.back} onClick={() => navigate("/documents")}>
        <ArrowLeft size={16} aria-hidden="true" /> Back to Library
      </button>
      <div className={styles.intro}>
        <h1 id="import-title">Import an agreement</h1>
        <p>Add a PDF to your library, then read it or set up a review.</p>
      </div>

      <form onSubmit={submit} className={styles.form} aria-label="Import agreement" aria-busy={pending}>
        <div className={`${styles.dropZone} ${dragActive ? styles.dragActive : ""}`} data-selected={!!file || undefined}
          onDragOver={(event) => { event.preventDefault(); if (!importing.current) setDragActive(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false); }}
          onDrop={(event) => { event.preventDefault(); setDragActive(false); selectFiles(Array.from(event.dataTransfer.files)); }}>
          {file ? <div className={styles.selectedFile}>
            <FileText size={25} aria-hidden="true" />
            <div><span className={styles.filename}>{file.name}</span><span className={styles.fileSize}>{importFileSize(file.size)} · PDF</span></div>
            <button type="button" className={styles.remove} disabled={pending} onClick={removeFile} aria-label={`Remove ${file.name}`}>
              <X size={17} aria-hidden="true" /><span>Remove</span>
            </button>
          </div> : <><Upload size={26} aria-hidden="true" /><h2>Drop a PDF here</h2></>}
          <p id="import-file-guidance">One PDF at a time · Up to {config.maxFileSizeMB} MB</p>
          <input ref={fileInput} id="source-pdf" type="file" accept="application/pdf,.pdf"
            aria-label="Choose a PDF agreement" aria-describedby="import-file-guidance import-extraction-boundary"
            className={styles.fileInput} tabIndex={-1} disabled={pending}
            onChange={(event) => {
              selectFiles(Array.from(event.target.files || []));
              event.target.value = "";
            }} />
          <button type="button" className="cl-button" disabled={pending} onClick={() => fileInput.current?.click()}>
            {file ? "Choose another PDF" : "Choose PDF"}
          </button>
        </div>

        {validation && <p role="alert" className={styles.error}>{validation}</p>}

        {failure && <div role="alert" className={styles.recovery}>
          <h2>{failure.documentId ? "Check the saved record" : "Check the library before importing again"}</h2>
          <p>{failure.message}</p>
          <p>{failure.documentId
            ? "Inspect the record’s source and extraction status before trying again. A document record does not confirm that the original was saved; if it was saved, do not upload it again to retry extraction."
            : "The result is uncertain: a saved original may already be in your library. This page will not retry the import automatically."}</p>
          <button type="button" className="cl-button" onClick={() => router.push(failure.documentId ? savedImportDestination(failure.documentId) : "/documents")}>
            {failure.documentId ? "Open saved record" : "Check Library"}<ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>}

        <div className={styles.actions}>
          <button type="submit" className="cl-button cl-primary" disabled={!file || pending || !!failure}>
            {pending ? <><LoaderCircle size={18} className={styles.spinner} aria-hidden="true" /> Importing agreement…</>
              : <>Import agreement<ArrowRight size={17} aria-hidden="true" /></>}
          </button>
          <p className={styles.boundary} id="import-extraction-boundary">Import is local and needs no API key. AI review is a separate paid action.</p>
        </div>
        {pending && <p role="status" className={styles.progress}>Saving the original and extracting text. Keep this page open for confirmation; any saved original remains in your library.</p>}
      </form>

      <details className={styles.extraction}><summary>Scans and text extraction</summary><p>Text extraction does not perform OCR and is not a completed review. Scanned or incomplete text is reported after import; you can still read the original PDF.</p></details>
      <details className={styles.example}>
        <summary>Try the synthetic example</summary>
        <p>Import <code>tests/fixtures/pdfs/managed-services-25p.pdf</code> for a ready-to-explore example review. These are fixed example findings, not a live AI review, and only appear for the exact sample PDF.</p>
      </details>
    </section>
    <ConfirmModal isOpen={!!destination} title={pending ? "Leave while the import is running?" : "Leave this import?"}
      message={pending
        ? "Leaving may interrupt confirmation. Any saved original stays in your library; check there before importing again."
        : failure ? "The selected file will be cleared. Any original already saved stays in your library; check it before importing again."
          : "This PDF has not been imported yet. Leaving clears the selection; the original file on your computer is unchanged."}
      confirmText="Leave page" cancelText={pending ? "Keep importing" : "Stay here"}
      onClose={() => setDestination(null)} onConfirm={leavePage} />
  </div>;
}
