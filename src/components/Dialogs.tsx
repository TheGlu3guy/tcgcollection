import { useRef, useState } from "react";
import {
  Check,
  Database,
  Download,
  FileJson,
  ListPlus,
  LockKeyhole,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { CONDITIONS, LIST_COLORS, VARIANTS } from "../lib/constants";
import { formatNumber } from "../lib/collection";
import type {
  AppData,
  CardList,
  Catalog,
  CatalogCard,
} from "../types";
import { CloseButton, Modal } from "./Shared";

export function ListPickerDialog({
  card,
  data,
  onClose,
  onToggle,
  onCreate,
}: {
  card: CatalogCard;
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
            const checked = list.cardKeys.includes(card.key);
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
  syncing,
}: {
  data: AppData;
  catalog: Catalog;
  onClose: () => void;
  onDataChange: (next: AppData) => void;
  onSync: () => void;
  onBackup: () => void;
  onImport: (file: File) => Promise<void> | void;
  syncing: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState("");
  return (
    <Modal onClose={onClose} className="settings-modal" labelledBy="settings-title">
      <div className="modal-heading">
        <div>
          <span className="eyebrow">Your workspace</span>
          <h2 id="settings-title">Settings & backup</h2>
          <p>All personal collection data is stored in this browser.</p>
        </div>
        <CloseButton onClick={onClose} />
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
        No account, tracking, or remote collection database. Clearing this browser's site
        data will remove your personal collection unless you exported a backup.
      </div>
    </Modal>
  );
}
