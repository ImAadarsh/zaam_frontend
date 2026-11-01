'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export type KeyValueRow = { key: string; value: string };

/** Parse a JSON object string into editable key/value rows (non-objects become one empty row). */
export function rowsFromJsonObject(raw: string): KeyValueRow[] {
  const trimmed = raw.trim();
  if (!trimmed) return [{ key: '', value: '' }];
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const rows = Object.entries(parsed).map(([key, value]) => ({
        key,
        value: typeof value === 'string' ? value : JSON.stringify(value)
      }));
      return rows.length ? rows : [{ key: '', value: '' }];
    }
  } catch {
    /* keep empty */
  }
  return [{ key: '', value: '' }];
}

/** Build a JSON object string from rows; empty keys are skipped. Returns '' when nothing left. */
export function jsonFromRows(rows: KeyValueRow[]): string {
  const obj: Record<string, string> = {};
  for (const row of rows) {
    const k = row.key.trim();
    if (!k) continue;
    obj[k] = row.value;
  }
  return Object.keys(obj).length ? JSON.stringify(obj, null, 2) : '';
}

type Props = {
  value: string;
  onChange: (json: string) => void;
  placeholderKey?: string;
  placeholderValue?: string;
};

/**
 * Friendly key/value editor that still stores attributes as a JSON object string.
 * Rows (including empty ones) live in local state so "+ Add attribute" works;
 * empty keys are still stripped when emitting JSON to the parent (save behavior).
 */
export function KeyValueEditor({
  value,
  onChange,
  placeholderKey = 'key',
  placeholderValue = 'value'
}: Props) {
  const [rows, setRows] = useState<KeyValueRow[]>(() => rowsFromJsonObject(value));
  /** Last JSON we emitted — skip prop→state sync for our own onChange echoes. */
  const lastEmittedRef = useRef(value);

  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    setRows(rowsFromJsonObject(value));
  }, [value]);

  function commit(next: KeyValueRow[]) {
    setRows(next);
    const json = jsonFromRows(next);
    lastEmittedRef.current = json;
    onChange(json);
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            type="text"
            className="input flex-1 font-mono text-xs"
            placeholder={placeholderKey}
            value={row.key}
            onChange={(e) => {
              const next = rows.map((r, idx) => (idx === i ? { ...r, key: e.target.value } : r));
              commit(next);
            }}
          />
          <input
            type="text"
            className="input flex-[1.4] text-xs"
            placeholder={placeholderValue}
            value={row.value}
            onChange={(e) => {
              const next = rows.map((r, idx) => (idx === i ? { ...r, value: e.target.value } : r));
              commit(next);
            }}
          />
          <button
            type="button"
            className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground"
            title="Remove row"
            onClick={() => {
              const next = rows.filter((_, idx) => idx !== i);
              commit(next.length ? next : [{ key: '', value: '' }]);
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-outline text-xs inline-flex items-center gap-1"
        onClick={() => commit([...rows, { key: '', value: '' }])}
      >
        <Plus size={12} /> Add attribute
      </button>
    </div>
  );
}
