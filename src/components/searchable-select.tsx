'use client';

import { useMemo, useState } from 'react';

export type SearchableOption = { value: string; label: string; searchText?: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  emptyLabel?: string;
  /** When true, typing a value not in the list offers “Use …” to set a custom value. */
  allowCustomValue?: boolean;
};

/** Combobox-style select: type to filter a long option list (Select2-like). */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Search…',
  disabled,
  required,
  className = '',
  emptyLabel = 'Select…',
  allowCustomValue = false
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 100);
    return options
      .filter((o) => (o.searchText || o.label).toLowerCase().includes(q))
      .slice(0, 100);
  }, [options, query]);

  const customCandidate = allowCustomValue ? query.trim() : '';
  const showCustom =
    !!customCandidate &&
    !options.some(
      (o) =>
        o.value.toLowerCase() === customCandidate.toLowerCase() ||
        o.label.toLowerCase() === customCandidate.toLowerCase()
    );

  const displayClosed = selected?.label || (allowCustomValue && value ? value : '');

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        className="input w-full"
        disabled={disabled}
        required={required && !value}
        placeholder={displayClosed || placeholder}
        value={open ? query : displayClosed}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          // Allow click on option before closing
          window.setTimeout(() => setOpen(false), 150);
        }}
        autoComplete="off"
      />
      {!open && !displayClosed && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
          {emptyLabel}
        </span>
      )}
      {open && !disabled && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('');
              setQuery('');
              setOpen(false);
            }}
          >
            {emptyLabel}
          </button>
          {showCustom && (
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-primary/10 text-primary"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(customCandidate);
                setQuery('');
                setOpen(false);
              }}
            >
              Use “{customCandidate}”
            </button>
          )}
          {filtered.length === 0 && !showCustom ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`w-full px-3 py-2 text-left text-sm hover:bg-primary/10 ${
                  o.value === value ? 'bg-primary/5 font-medium' : ''
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o.value);
                  setQuery('');
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
