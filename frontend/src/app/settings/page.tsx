"use client";

import { useEffect, useRef, useState } from "react";
import type { AvailableModel } from "@clauseiq/shared-types";
import { useWorkspace, type WorkspaceSettingsUpdate } from "@/context/WorkspaceContext";
import { effortForModel, formatModelRate, getModelSelectionError, getSelectableModels, reasoningLabel } from "@/lib/modelSelection";
import Button from "@/components/Button";
import Card from "@/components/Card";
import ConfirmModal from "@/components/ui/ConfirmModal";
import styles from "./Settings.module.css";

const inputClass = styles.input;

function ModelDetails({ model }: { model: AvailableModel }) {
  return <details className={styles.modelDetails}>
    <summary>Model details and reference pricing</summary>
    <div className={styles.modelDetailBody}>
    <p>{model.description}</p>
    <dl className={styles.modelFacts}>
      <div><dt>Model ID</dt><dd><code>{model.id}</code></dd></div>
      <div><dt>Input / 1M tokens</dt><dd>{formatModelRate(model.input_price_per_million)} USD</dd></div>
      <div><dt>Output / 1M tokens</dt><dd>{formatModelRate(model.output_price_per_million)} USD</dd></div>
    </dl>
    <p className={styles.help}>Base reference prices checked {model.pricing_verified_on}; not a document estimate. {model.pricing_note} <a href="https://developers.openai.com/api/docs/pricing" target="_blank" rel="noopener noreferrer">Check OpenAI pricing</a>.</p>
    {model.legacy && <p className={styles.warning}>Your saved legacy model is preserved. Choose another model explicitly when you are ready to change it.</p>}
    </div>
  </details>;
}

export default function Settings() {
  const { settings, isLoading, error: connectionError, refresh, updateSettings, saveApiKey, removeApiKey } = useWorkspace();
  const [apiKey, setApiKey] = useState("");
  const [editingKey, setEditingKey] = useState(false);
  const [modelId, setModelId] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState("medium");
  const [queryModelId, setQueryModelId] = useState("");
  const [retentionEnabled, setRetentionEnabled] = useState(false);
  const [retentionDays, setRetentionDays] = useState("30");
  const [toastsEnabled, setToastsEnabled] = useState(true);
  const [saving, setSaving] = useState<"key" | "settings" | "remove" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pendingSettings, setPendingSettings] = useState<WorkspaceSettingsUpdate | null>(null);
  const keyInput = useRef<HTMLInputElement>(null);
  const keyActions = useRef<HTMLDivElement>(null);
  const keyFocusIntent = useRef<"input" | "change" | null>(null);
  const models = settings?.available_models ?? [];
  const reviewModel = models.find((model) => model.id === modelId);
  const queryModel = models.find((model) => model.id === queryModelId);
  const selectionError = getModelSelectionError(models, modelId, queryModelId, reasoningEffort);
  const settingsDirty = !!settings && (modelId !== settings.model_id
    || reasoningEffort !== (settings.reasoning_effort || "medium")
    || queryModelId !== settings.query_gate_model_id
    || retentionEnabled !== ((settings.retention_days || 0) > 0)
    || (retentionEnabled ? Number(retentionDays) : 0) !== (settings.retention_days || 0)
    || toastsEnabled !== (settings.toast_notifications_enabled ?? true));
  const showKeyForm = !settings?.has_api_key || settings.api_key_needs_reentry || editingKey;

  useEffect(() => {
    if (saving) return;
    const target = keyFocusIntent.current === "input" && showKeyForm ? keyInput.current
      : keyFocusIntent.current === "change" && !showKeyForm
        ? keyActions.current?.querySelector<HTMLButtonElement>("[data-key-change]") : null;
    if (target) { target.focus(); keyFocusIntent.current = null; }
  }, [showKeyForm, saving]);

  useEffect(() => { setModelId(settings?.model_id || ""); }, [settings?.model_id]);
  useEffect(() => { setReasoningEffort(settings?.reasoning_effort || "medium"); }, [settings?.reasoning_effort]);
  useEffect(() => { setQueryModelId(settings?.query_gate_model_id || ""); }, [settings?.query_gate_model_id]);
  useEffect(() => {
    setRetentionEnabled((settings?.retention_days || 0) > 0);
    setRetentionDays(String(settings?.retention_days || 30));
  }, [settings?.retention_days]);
  useEffect(() => { setToastsEnabled(settings?.toast_notifications_enabled ?? true); }, [settings?.toast_notifications_enabled]);

  const saveKey = async () => {
    if (!apiKey.trim()) { setError("Enter your OpenAI API key."); return; }
    setSaving("key"); setError(null); setMessage(null);
    try {
      await saveApiKey(apiKey.trim());
      setApiKey("");
      keyFocusIntent.current = "change";
      setEditingKey(false);
      setMessage("API key saved. No AI request was made.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the API key.");
    } finally { setSaving(null); }
  };

  const deleteKey = async () => {
    setSaving("remove"); setError(null); setMessage(null);
    try {
      await removeApiKey();
      setApiKey("");
      setEditingKey(false);
      setConfirmRemove(false);
      setMessage("API key removed. Saved documents remain available.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to remove the API key.");
      setConfirmRemove(false);
    } finally { setSaving(null); }
  };

  const saveSettings = async (update: WorkspaceSettingsUpdate) => {
    setSaving("settings"); setError(null); setMessage(null);
    try {
      await updateSettings(update);
      setMessage("Workspace settings saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save settings.");
    } finally { setSaving(null); setPendingSettings(null); }
  };

  const requestSettingsSave = () => {
    if (!settings || saving || connectionError || !settingsDirty) return;
    if (selectionError) { setError(selectionError); return; }
    const days = retentionEnabled ? Number(retentionDays) : 0;
    if (!Number.isInteger(days) || days > 36500 || (retentionEnabled && days < 1)) {
      setError("Enter a whole number of days from 1 to 36500, or turn automatic deletion off.");
      return;
    }
    const update = { model_id: modelId, reasoning_effort: reasoningEffort, query_gate_model_id: queryModelId, retention_days: days, toast_notifications_enabled: toastsEnabled };
    if (days > 0 && days !== settings?.retention_days) setPendingSettings(update);
    else void saveSettings(update);
  };

  if (isLoading && !settings) return <div className={styles.page} role="status">Loading workspace settings…</div>;

  return <div className={styles.page}>
    <header className={styles.intro}>
      <h1>Settings</h1>
      <p>AI access and workspace preferences.</p>
    </header>
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <nav aria-label="Settings sections">
          <a href="#ai-access">OpenAI API key</a>
          <a href="#ai-models">AI models</a>
          <a href="#document-library">Document library</a>
          <a href="#notifications">Notifications</a>
        </nav>
      </aside>
      <div className={styles.content}>
    {connectionError && <Card className="p-5 space-y-3"><p role="alert" className="text-accent-rose">{connectionError}</p><Button variant="secondary" onClick={() => void refresh()} loading={isLoading}>Retry connection</Button></Card>}
    {error && <p role="alert" className="text-accent-rose bg-accent-rose/10 rounded-lg p-4">{error}</p>}
    {message && <p role="status" className="text-accent-green bg-accent-green/10 rounded-lg p-4">{message}</p>}

    {settings && <>
      <section id="ai-access" aria-labelledby="ai-access-title" className={styles.section}>
        <div className={styles.sectionHeading}><div><div className={styles.titleRow}><h2 id="ai-access-title">OpenAI API key</h2><span className={`${styles.status} ${settings.api_key_needs_reentry ? styles.statusWarning : ""}`}>{settings.api_key_needs_reentry ? "Key needs attention" : settings.has_api_key ? "Key saved" : "No key saved"}</span></div><p>{settings.api_key_needs_reentry ? "Re-enter your key to enable AI." : settings.has_api_key ? "Stored encrypted in your local workspace." : "Add your own key to review agreements and ask AI."}</p></div>
          <div ref={keyActions} className={styles.keyActions}>
            {settings.has_api_key && !showKeyForm && <Button type="button" data-key-change variant="secondary" disabled={!!saving} onClick={() => { keyFocusIntent.current = "input"; setEditingKey(true); setMessage(null); }}>Change key</Button>}
            {settings.has_api_key && <Button type="button" variant="ghost" disabled={!!saving} onClick={() => setConfirmRemove(true)}>Remove key</Button>}
          </div></div>
        {settings.api_key_needs_reentry && <p role="alert" className={styles.warning}>The previous key could not be restored. Enter your OpenAI API key again; your saved documents are unchanged.</p>}
        {showKeyForm && <form onSubmit={(event) => { event.preventDefault(); void saveKey(); }} className={styles.keyForm} aria-label="API key">
          <label htmlFor="openai-key" className="block text-sm font-medium">{settings.has_api_key ? "Replacement API key" : "API key"}</label>
          <input ref={keyInput} id="openai-key" type="password" value={apiKey} autoComplete="off" spellCheck={false} className={inputClass} aria-describedby="key-usage" placeholder="Enter your OpenAI API key" disabled={!!saving}
            onChange={(event) => setApiKey(event.target.value)} />
          <div className={styles.formActions}>
            <Button type="submit" loading={saving === "key"} disabled={!apiKey.trim() || !!saving}>{settings.has_api_key ? "Replace key" : "Save key"}</Button>
            {settings.has_api_key && !settings.api_key_needs_reentry && <Button type="button" variant="secondary" disabled={!!saving} onClick={() => { keyFocusIntent.current = "change"; setEditingKey(false); setApiKey(""); }}>Cancel</Button>}
          </div>
        </form>}
        <p id="key-usage" className={styles.help}>Reviews and Ask send document text to OpenAI and incur charges on your API account.</p>
        <details className={styles.disclosure}><summary>Key storage and privacy</summary><p>The key is encrypted by your local backend, never stored in your browser. Saving a key does not test it or start an AI request. Importing, reading and saving your notes stay local.</p></details>
      </section>

      <form onSubmit={(event) => { event.preventDefault(); requestSettingsSave(); }} className={styles.settingsForm} aria-label="Workspace preferences">
        <div className={styles.saveBar}><p aria-live="polite">{settingsDirty ? "Unsaved changes" : "No unsaved changes"}</p><Button type="submit" loading={saving === "settings"} disabled={!settingsDirty || !!saving || !!connectionError || !!selectionError}>Save changes</Button></div>
        <section id="ai-models" aria-labelledby="ai-models-title" className={styles.section}>
          <div className={styles.sectionHeading}><div><h2 id="ai-models-title">AI models</h2><p>For new reviews and Ask. Saved results stay unchanged.</p></div></div>
          <div className={styles.modelFields}><div className={styles.field}>
          <label htmlFor="analysis-model" className="block text-sm font-medium">Review model</label>
          <select id="analysis-model" value={modelId} className={inputClass} aria-invalid={!reviewModel} disabled={!!saving} onChange={(event) => {
            setMessage(null);
            const next = models.find(model => model.id === event.target.value);
            setModelId(event.target.value);
            if (next) {
              const effort = effortForModel(next, reasoningEffort);
              if (effort !== reasoningEffort) setMessage(`${next.name} does not support ${reasoningLabel(reasoningEffort)} reasoning. Set to ${reasoningLabel(effort)}; save to apply.`);
              setReasoningEffort(effort);
            }
          }}>
            {!reviewModel && <option value={modelId} disabled>{modelId ? `Unavailable model: ${modelId}` : "Choose a review model"}</option>}
            {getSelectableModels(models, modelId).map((model) => <option key={model.id} value={model.id}>{model.name}{model.legacy ? " (saved legacy model)" : ""}</option>)}
          </select>
          </div><div className={styles.field}>
          <label htmlFor="reasoning-effort" className="block text-sm font-medium">Reasoning effort</label>
          <select id="reasoning-effort" value={reasoningEffort} className={inputClass} aria-describedby="reasoning-help" disabled={!!saving || !reviewModel}
            onChange={event => { setReasoningEffort(event.target.value); setMessage(null); }}>
            {reviewModel && !reviewModel.reasoning_efforts.includes(reasoningEffort) && <option value={reasoningEffort} disabled>Unsupported effort: {reasoningEffort}</option>}
            {reviewModel?.reasoning_efforts.map(effort => <option key={effort} value={effort}>{reasoningLabel(effort)}{effort === "medium" ? " (recommended)" : ""}</option>)}
          </select>
          </div></div>
          <p id="reasoning-help" className={styles.help}>Higher reasoning effort can increase time and cost, without guaranteeing a better answer.</p>
          {reviewModel && <ModelDetails model={reviewModel} />}
          {selectionError && <p role="alert" className={styles.warning}>{selectionError}</p>}
          <details className={styles.disclosure}>
            <summary>Advanced model behaviour</summary>
            <div className={styles.advancedContent}>
              <p className={styles.help}>Your API account must support the selected model. ClauseIQ does not silently switch models. These preferences also apply to retained earlier-analysis tools.</p>
              <div className={styles.field}>
              <label htmlFor="query-model" className="block text-sm font-medium">Chat query classification model</label>
              <select id="query-model" value={queryModelId} className={inputClass} aria-invalid={!queryModel} aria-describedby="query-model-help" disabled={!!saving} onChange={(event) => { setQueryModelId(event.target.value); setMessage(null); }}>
                {!queryModel && <option value={queryModelId} disabled>{queryModelId ? `Unavailable model: ${queryModelId}` : "Choose a classification model"}</option>}
                {getSelectableModels(models, queryModelId).map((model) => <option key={model.id} value={model.id}>{model.name}{model.legacy ? " (saved legacy model)" : ""}</option>)}
              </select>
              </div>
              <p id="query-model-help" className={styles.help}>Only for earlier-analysis chat, at Low effort. Review model changes do not affect this selection. Finding-scoped Ask uses the review model and effort.</p>
              {queryModel && <ModelDetails model={queryModel} />}
            </div>
          </details>
        </section>

        <section id="document-library" aria-labelledby="document-library-title" className={styles.section}>
          <div className={styles.preferenceRow}><div><h2 id="document-library-title">Document library</h2><p className={styles.help}>No document limit. Keep files until you delete them.</p></div>
          <label className={styles.checkLabel}><input type="checkbox" checked={retentionEnabled} disabled={!!saving} onChange={(event) => { setRetentionEnabled(event.target.checked); setMessage(null); }} /><span>Automatic deletion</span></label></div>
          {retentionEnabled && <div className={styles.retentionFields}>
            <label htmlFor="retention-days" className="block text-sm font-medium">Delete after upload</label>
            <div className={styles.daysInput}><input id="retention-days" type="number" min="1" max="36500" step="1" value={retentionDays} disabled={!!saving} className={inputClass} aria-describedby="retention-unit retention-warning" onChange={(event) => { setRetentionDays(event.target.value); setMessage(null); }} /><span id="retention-unit">days</span></div>
            <p id="retention-warning" className={styles.warning}>Deletion permanently removes the original PDF, analysis, notes, chat history, and vector data. Existing older documents are included.</p>
          </div>}
        </section>

        <section id="notifications" aria-labelledby="notifications-title" className={styles.section}>
          <div className={styles.preferenceRow}><h2 id="notifications-title">Notifications</h2>
          <label className={styles.checkLabel}><input type="checkbox" checked={toastsEnabled} disabled={!!saving} onChange={(event) => { setToastsEnabled(event.target.checked); setMessage(null); }} /><span>Show pop-up notifications</span></label></div>
        </section>
      </form>
    </>}
      </div>
    </div>

    <ConfirmModal isOpen={confirmRemove} title="Remove your API key?" message="AI features will stop working until you add a key again. Existing documents, notes, and saved results will remain."
      confirmText="Remove key" confirmVariant="danger" loading={saving === "remove"} onClose={() => setConfirmRemove(false)} onConfirm={() => void deleteKey()} />
    <ConfirmModal isOpen={!!pendingSettings} title="Enable automatic deletion?" message={`Documents uploaded more than ${pendingSettings?.retention_days ?? 0} days ago, including documents already in your library, will be eligible for permanent deletion. Their PDFs, analyses, notes, chat history, and vector data cannot be restored from ClauseIQ. Back up anything you need before continuing.`}
      confirmText="Enable and save" confirmVariant="danger" loading={saving === "settings"} onClose={() => setPendingSettings(null)} onConfirm={() => { if (pendingSettings) void saveSettings(pendingSettings); }} />
  </div>;
}
