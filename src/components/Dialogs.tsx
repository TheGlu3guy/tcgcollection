import { useRef, useState } from "react";
import {
  Check,
  Cloud,
  Database,
  Download,
  FileJson,
  ListPlus,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react";
import { CONDITIONS, LANGUAGES, LIST_COLORS, VARIANTS } from "../lib/constants";
import { formatNumber } from "../lib/collection";
import type { CloudSyncState } from "../lib/cloud";
import type {
  AppData,
  CardList,
  Catalog,
  CatalogCard,
} from "../types";
import { CloseButton, Modal } from "./Shared";

export function ListPickerDialog({
  card,
  variantKeys,
  data,
  onClose,
  onToggle,
  onCreate,
}: {
  card: CatalogCard;
  variantKeys: string[];
  data: AppData;
  onClose: () => void;
  onToggle: (listId: string) => void;
  onCreate: () => void;
}) {
  return (
    <Modal onClose={onClose} className="small-modal" labelledBy="list-picker-title">
      <div className="modal-heading">
        <div>
          <span className="eyebrow">Organize card</span>
          <h2 id="list-picker-title">{card.name}</h2>
          <p>Choose every list this card belongs to.</p>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      {data.lists.length === 0 ? (
        <div className="dialog-empty">
          <ListPlus size={29} />
          <h3>No custom lists yet</h3>
          <p>Make a list for trades, binder pages, deck ideas, or anything else.</p>
          <button className="primary-button" type="button" onClick={onCreate}>
            <Plus size={16} /> Create a list
          </button>
        </div>
      ) : (
        <div className="list-picker-options">
          {data.lists.map((list) => {
            const checked = list.cardKeys.some((key) => variantKeys.includes(key));
            return (
              <button
                type="button"
                key={list.id}
                className={checked ? "active" : ""}
                onClick={() => onToggle(list.id)}
              >
                <span className="list-color-dot" style={{ background: list.color }} />
                <span>
                  <strong>{list.name}</strong>
                  <small>{list.cardKeys.length} cards</small>
                </span>
                <span className="list-check-icon">{checked && <Check size={16} />}</span>
              </button>
            );
          })}
          <button type="button" className="new-list-row" onClick={onCreate}>
            <Plus size={17} /> Create another list
          </button>
        </div>
      )}
    </Modal>
  );
}

export function BulkListDialog({
  count,
  lists,
  onClose,
  onAdd,
  onCreate,
}: {
  count: number;
  lists: CardList[];
  onClose: () => void;
  onAdd: (listId: string) => void;
  onCreate: () => void;
}) {
  return (
    <Modal onClose={onClose} className="small-modal" labelledBy="bulk-list-title">
      <div className="modal-heading">
        <div>
          <span className="eyebrow">Add selected cards</span>
          <h2 id="bulk-list-title">Choose a list</h2>
          <p>
            Add {count} selected card{count === 1 ? "" : "s"} to a custom list.
          </p>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      {lists.length === 0 ? (
        <div className="dialog-empty">
          <ListPlus size={29} />
          <h3>No custom lists yet</h3>
          <p>Create a list and the selected cards will be added automatically.</p>
          <button className="primary-button" type="button" onClick={onCreate}>
            <Plus size={16} /> Create list
          </button>
        </div>
      ) : (
        <div className="list-picker-options">
          {lists.map((list) => (
            <button
              type="button"
              key={list.id}
              onClick={() => onAdd(list.id)}
            >
              <span className="list-color-dot" style={{ background: list.color }} />
              <span>
                <strong>{list.name}</strong>
                <small>{list.cardKeys.length} cards</small>
              </span>
              <ListPlus size={16} />
            </button>
          ))}
          <button type="button" className="new-list-row" onClick={onCreate}>
            <Plus size={17} /> Create a new list
          </button>
        </div>
      )}
    </Modal>
  );
}

export function ListEditorDialog({
  list,
  onClose,
  onSave,
}: {
  list?: CardList;
  onClose: () => void;
  onSave: (values: Pick<CardList, "name" | "description" | "color">) => void;
}) {
  const [name, setName] = useState(list?.name ?? "");
  const [description, setDescription] = useState(list?.description ?? "");
  const [color, setColor] = useState(list?.color ?? LIST_COLORS[0]);
  return (
    <Modal onClose={onClose} className="small-modal list-editor-modal" labelledBy="list-editor-title">
      <div className="modal-heading">
        <div>
          <span className="eyebrow">{list ? "Update list" : "New list"}</span>
          <h2 id="list-editor-title">{list ? "Edit list" : "Create a list"}</h2>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          onSave({ name: name.trim(), description: description.trim(), color });
        }}
      >
        <label className="form-field">
          <span>List name</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Trade binder, Eevee collection"
            maxLength={60}
          />
        </label>
        <label className="form-field">
          <span>Description <small>optional</small></span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is this list for?"
            rows={3}
            maxLength={160}
          />
        </label>
        <fieldset className="color-field">
          <legend>List color</legend>
          <div>
            {LIST_COLORS.map((item) => (
              <button
                type="button"
                key={item}
                className={color === item ? "active" : ""}
                style={{ background: item }}
                onClick={() => setColor(item)}
                aria-label={`Use color ${item}`}
              >
                {color === item && <Check size={15} />}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={!name.trim()}>
            {list ? "Save changes" : "Create list"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function SettingsDialog({
  data,
  catalog,
  onClose,
  onDataChange,
  onSync,
  onBackup,
  onImport,
  cloud,
  onCloudSignIn,
  onCloudSignUp,
  onCloudSignOut,
  onCloudPasswordReset,
  passwordRecovery,
  onCloudUpdatePassword,
  onCloudSync,
  syncing,
}: {
  data: AppData;
  catalog: Catalog;
  onClose: () => void;
  onDataChange: (next: AppData) => void;
  onSync: () => void;
  onBackup: () => void;
  onImport: (file: File) => Promise<void> | void;
  cloud: CloudSyncState;
  onCloudSignIn: (email: string, password: string) => Promise<void>;
  onCloudSignUp: (email: string, password: string) => Promise<void>;
  onCloudSignOut: () => Promise<void>;
  onCloudPasswordReset: (email: string) => Promise<void>;
  passwordRecovery: boolean;
  onCloudUpdatePassword: (password: string) => Promise<void>;
  onCloudSync: () => Promise<void>;
  syncing: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  const runAuthAction = async (action: () => Promise<void>) => {
    setAuthBusy(true);
    setAuthError("");
    setAuthMessage("");
    try {
      await action();
    } catch (reason) {
      setAuthError(reason instanceof Error ? reason.message : "Account request failed.");
    } finally {
      setAuthBusy(false);
    }
  };

  const submitAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setAuthError("Enter your email and password.");
      return;
    }
    if (authMode === "signup" && password !== confirmPassword) {
      setAuthError("The passwords do not match.");
      return;
    }
    await runAuthAction(async () => {
      if (authMode === "signup") {
        await onCloudSignUp(email, password);
        setAuthMessage(
          "Account created. If Supabase asks for email confirmation, confirm it before signing in.",
        );
      } else {
        await onCloudSignIn(email, password);
      }
    });
  };

  const resetPassword = async () => {
    if (!email.trim()) {
      setAuthError("Enter your email first.");
      return;
    }
    await runAuthAction(async () => {
      await onCloudPasswordReset(email);
      setAuthMessage("Password reset email sent. Check your inbox.");
    });
  };

  const submitNewPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 6) {
      setAuthError("Use at least 6 characters for the new password.");
      return;
    }
    if (password !== confirmPassword) {
      setAuthError("The passwords do not match.");
      return;
    }
    await runAuthAction(async () => {
      await onCloudUpdatePassword(password);
      setAuthMessage("Password updated. Your cloud session remains active.");
      setPassword("");
      setConfirmPassword("");
    });
  };

  const statusLabel =
    cloud.status === "saving"
      ? "Saving to cloud"
      : cloud.status === "loading"
        ? "Loading cloud collection"
        : cloud.status === "synced"
          ? "Cloud sync active"
          : cloud.status === "error"
            ? "Cloud sync needs attention"
            : "Not signed in";

  return (
    <Modal onClose={onClose} className="settings-modal" labelledBy="settings-title">
      <div className="modal-heading">
        <div>
          <span className="eyebrow">Your workspace</span>
          <h2 id="settings-title">Settings & backup</h2>
          <p>Keep your collection in sync across every device you use.</p>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      <div className="settings-section cloud-account-section">
        <div className="settings-section-heading">
          <Cloud size={18} />
          <div>
            <strong>Cloud account</strong>
            <span>{statusLabel}</span>
          </div>
          {cloud.email && <span className="cloud-status-pill">Live</span>}
        </div>

        {!cloud.configured ? (
          <div className="cloud-setup-note">
            <strong>Supabase is not connected yet.</strong>
            <p>
              Add <code>VITE_SUPABASE_URL</code> and{" "}
              <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env.local</code>, then restart
              the local app. GitHub Pages uses repository secrets with the same names.
            </p>
          </div>
        ) : !cloud.authReady ? (
          <div className="cloud-account-loading">
            <RefreshCcw size={16} className="spin" /> Checking your cloud account…
          </div>
        ) : cloud.email && passwordRecovery ? (
          <form className="cloud-auth-form" onSubmit={submitNewPassword}>
            <div>
              <strong className="cloud-recovery-title">Choose a new password</strong>
              <p className="cloud-recovery-copy">
                Your reset link signed you in securely. Set a new password to finish.
              </p>
            </div>
            <label className="form-field">
              <span>New password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />
            </label>
            <label className="form-field">
              <span>Confirm new password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={6}
                required
              />
            </label>
            <button className="primary-button" type="submit" disabled={authBusy}>
              <ShieldCheck size={16} />
              {authBusy ? "Updating…" : "Update password"}
            </button>
            {authError && <p className="settings-warning">{authError}</p>}
            {authMessage && <p className="settings-success">{authMessage}</p>}
          </form>
        ) : cloud.email ? (
          <div className="cloud-account-card">
            <div className="cloud-account-identity">
              <span><UserRound size={17} /></span>
              <div>
                <strong>{cloud.email}</strong>
                <small>
                  {cloud.lastSyncedAt
                    ? `Last synced ${new Date(cloud.lastSyncedAt).toLocaleString()}`
                    : "Waiting for an initial sync"}
                </small>
              </div>
            </div>
            <div className="cloud-account-actions">
              <button
                type="button"
                className="secondary-button small"
                disabled={cloud.status === "loading" || cloud.status === "saving"}
                onClick={() =>
                  void runAuthAction(async () => {
                    await onCloudSync();
                    setAuthMessage("Cloud collection synced.");
                  })
                }
              >
                <RefreshCcw
                  size={15}
                  className={cloud.status === "saving" ? "spin" : ""}
                />
                Sync now
              </button>
              <button
                type="button"
                className="secondary-button small"
                onClick={() => void runAuthAction(onCloudSignOut)}
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
            {cloud.error && <p className="settings-warning">{cloud.error}</p>}
            {authError && <p className="settings-warning">{authError}</p>}
            {authMessage && <p className="settings-success">{authMessage}</p>}
          </div>
        ) : (
          <form className="cloud-auth-form" onSubmit={submitAccount}>
            <div className="cloud-auth-tabs" role="tablist" aria-label="Cloud account action">
              <button
                type="button"
                className={authMode === "signin" ? "active" : ""}
                onClick={() => {
                  setAuthMode("signin");
                  setAuthError("");
                  setAuthMessage("");
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                className={authMode === "signup" ? "active" : ""}
                onClick={() => {
                  setAuthMode("signup");
                  setAuthError("");
                  setAuthMessage("");
                }}
              >
                Create account
              </button>
            </div>
            <label className="form-field">
              <span>Email</span>
              <div className="cloud-input-wrap">
                <Mail size={15} />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </label>
            <label className="form-field">
              <span>Password</span>
              <input
                type="password"
                autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />
            </label>
            {authMode === "signup" && (
              <label className="form-field">
                <span>Confirm password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={6}
                  required
                />
              </label>
            )}
            <div className="cloud-auth-actions">
              <button className="primary-button" type="submit" disabled={authBusy}>
                <LogIn size={16} />
                {authBusy
                  ? "Please wait…"
                  : authMode === "signin"
                    ? "Sign in and sync"
                    : "Create cloud account"}
              </button>
              {authMode === "signin" && (
                <button type="button" className="text-button" onClick={() => void resetPassword()}>
                  Forgot password?
                </button>
              )}
            </div>
            {authError && <p className="settings-warning">{authError}</p>}
            {authMessage && <p className="settings-success">{authMessage}</p>}
            {cloud.error && <p className="settings-warning">{cloud.error}</p>}
          </form>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-section-heading">
          <Database size={18} />
          <div>
            <strong>Catalog</strong>
            <span>
              {formatNumber(catalog.cards.length)} cards · {formatNumber(catalog.sets.length)} sets
            </span>
          </div>
        </div>
        <div className="catalog-status-row">
          <span>
            Last synced{" "}
            {new Date(catalog.fetchedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
          <button type="button" className="secondary-button small" onClick={onSync} disabled={syncing}>
            <RefreshCcw size={15} className={syncing ? "spin" : ""} />
            {syncing ? "Syncing…" : "Refresh"}
          </button>
        </div>
        {catalog.failedLanguages.length > 0 && (
          <p className="settings-warning">
            {catalog.failedLanguages.length} regional catalogs could not be refreshed.
          </p>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-section-heading">
          <ShieldCheck size={18} />
          <div>
            <strong>Collection defaults</strong>
            <span>Used when you add a card quickly.</span>
          </div>
        </div>
        <div className="settings-form-grid">
          <label className="form-field settings-language-field">
            <span>Card display language</span>
            <select
              value={data.preferences.catalogLanguage}
              onChange={(event) =>
                onDataChange({
                  ...data,
                  preferences: {
                    ...data.preferences,
                    catalogLanguage: event.target.value as AppData["preferences"]["catalogLanguage"],
                  },
                })
              }
            >
              <option value="all">All languages · English first</option>
              {LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.flag} {language.label}
                </option>
              ))}
            </select>
            <small>
              All languages shows one card version, preferring English and falling
              back to another available language.
            </small>
          </label>
          <label className="form-field">
            <span>Condition</span>
            <select
              value={data.preferences.defaultCondition}
              onChange={(event) =>
                onDataChange({
                  ...data,
                  preferences: { ...data.preferences, defaultCondition: event.target.value },
                })
              }
            >
              {CONDITIONS.map((condition) => (
                <option key={condition}>{condition}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Variant</span>
            <select
              value={data.preferences.defaultVariant}
              onChange={(event) =>
                onDataChange({
                  ...data,
                  preferences: { ...data.preferences, defaultVariant: event.target.value },
                })
              }
            >
              {VARIANTS.map((variant) => (
                <option key={variant}>{variant}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-heading">
          <FileJson size={18} />
          <div>
            <strong>Portable backup</strong>
            <span>Keep a copy of your collection, lists, notes, and wishlist.</span>
          </div>
        </div>
        <div className="backup-actions">
          <button type="button" className="secondary-button" onClick={onBackup}>
            <Download size={16} /> Export backup
          </button>
          <button type="button" className="secondary-button" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Import backup
          </button>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setImportError("");
              try {
                await onImport(file);
              } catch (reason) {
                setImportError(reason instanceof Error ? reason.message : "Could not import backup.");
              }
              event.target.value = "";
            }}
          />
        </div>
        {importError && <p className="settings-warning">{importError}</p>}
      </div>

      <div className="privacy-note">
        <LockKeyhole size={16} />
        Your cloud collection is protected per account by Supabase Row Level Security.
        Keep a JSON backup as an independent recovery copy.
      </div>
    </Modal>
  );
}
