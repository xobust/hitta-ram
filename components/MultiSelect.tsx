'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';

export interface MultiSelectOption<T = string | number> {
  label: string;
  value: T;
}

interface MultiSelectProps<T = string | number> {
  options: MultiSelectOption<T>[];
  value: T[];
  onChange: (next: T[]) => void;
  placeholder?: string;
  className?: string;
}

export default function MultiSelect<T = string | number>({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className = '',
}: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const normalized = useMemo(() => options, [options]);
  const filtered = useMemo(() => {
    if (!query.trim()) return normalized;
    const q = query.toLowerCase();
    return normalized.filter(o => o.label.toLowerCase().includes(q));
  }, [normalized, query]);

  const toggle = useCallback((v: T) => {
    const exists = value.some(x => String(x) === String(v));
    if (exists) onChange(value.filter(x => String(x) !== String(v)));
    else onChange([...value, v]);
  }, [value, onChange]);

  const selectAll = useCallback(() => {
    const all = filtered.map(f => f.value);
    const merged = Array.from(new Set([...value, ...all]));
    onChange(merged);
  }, [filtered, value, onChange]);

  const clearAll = useCallback(() => onChange([]), [onChange]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        className="input-field w-full flex items-center justify-between"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex flex-wrap gap-1 items-center">
          {value.length === 0 && (
            <span className="text-gray-400">{placeholder}</span>
          )}
          {value.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {value.slice(0, 3).map((v, idx) => (
                <span key={String(v)+idx} className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700 border">
                  {normalized.find(o => String(o.value) === String(v))?.label ?? String(v)}
                </span>
              ))}
              {value.length > 3 && (
                <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700 border">
                  +{value.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
        <ChevronsUpDown className="h-4 w-4 text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full bg-white border rounded shadow">
          <div className="p-2 border-b flex items-center gap-2">
            <input
              placeholder="Search..."
              className="input-field w-full"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {value.length > 0 && (
              <button className="btn-secondary text-xs" onClick={clearAll} title="Clear">
                <X className="h-4 w-4" />
              </button>
            )}
            <button className="btn-secondary text-xs" onClick={selectAll} title="Select all filtered">All</button>
          </div>
          <div className="max-h-56 overflow-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">No results</div>
            )}
            {filtered.map(opt => {
              const checked = value.some(v => String(v) === String(opt.value));
              return (
                <label
                  key={String(opt.value)}
                  className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt.value)}
                    />
                    <span className="text-sm text-gray-800">{opt.label}</span>
                  </div>
                  {checked && <Check className="h-4 w-4 text-green-600" />}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


