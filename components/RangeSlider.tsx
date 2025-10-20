'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface RangeSliderProps {
  min: number;
  max: number;
  value: [number, number] | undefined;
  onChange: (next: [number, number]) => void;
  step?: number;
  ticks?: number[];
  snapValues?: number[]; // if provided, snap thumbs to these values
  label?: string;
}

export default function RangeSlider({ min, max, value, onChange, step = 1, ticks = [], snapValues, label }: RangeSliderProps) {
  const [local, setLocal] = useState<[number, number]>(() => value ?? [min, max]);

  useEffect(() => {
    if (!value) return;
    setLocal(value);
  }, [value]);

  const snap = useCallback((n: number) => {
    if (!snapValues || snapValues.length === 0) return n;
    let best = snapValues[0];
    let diff = Math.abs(n - best);
    for (let i = 1; i < snapValues.length; i++) {
      const d = Math.abs(n - snapValues[i]);
      if (d < diff) { best = snapValues[i]; diff = d; }
    }
    return best;
  }, [snapValues]);

  const update = useCallback((next: [number, number]) => {
    const a = Math.max(min, Math.min(max, next[0]));
    const b = Math.max(min, Math.min(max, next[1]));
    const sorted: [number, number] = a <= b ? [a, b] : [b, a];
    setLocal(sorted);
    onChange(sorted);
  }, [min, max, onChange]);

  const onInputChange = useCallback((idx: 0 | 1, v: string) => {
    const n = Number(v);
    if (Number.isNaN(n)) return;
    const next: [number, number] = idx === 0 ? [n, local[1]] : [local[0], n];
    update(next);
  }, [local, update]);

  const onRangeChange = useCallback((idx: 0 | 1, v: string) => {
    let n = Number(v);
    if (snapValues && snapValues.length) n = snap(n);
    const next: [number, number] = idx === 0 ? [n, local[1]] : [local[0], n];
    update(next);
  }, [local, update, snap, snapValues]);

  const ticksMemo = useMemo(() => ticks.filter(t => t >= min && t <= max), [ticks, min, max]);

  return (
    <div className="space-y-2">
      {label && <div className="text-xs text-gray-600">{label}</div>}
      <div className="flex items-center gap-2">
        <input
          type="number"
          className="input-field w-24"
          value={local[0]}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onInputChange(0, e.target.value)}
        />
        <div className="flex-1 relative">
          <input type="range" min={min} max={max} step={step} value={local[0]} onChange={(e) => onRangeChange(0, e.target.value)} className="w-full" />
          <input type="range" min={min} max={max} step={step} value={local[1]} onChange={(e) => onRangeChange(1, e.target.value)} className="w-full -mt-2" />
        </div>
        <input
          type="number"
          className="input-field w-24"
          value={local[1]}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onInputChange(1, e.target.value)}
        />
      </div>
      {ticksMemo.length > 0 && (
        <div className="flex justify-between text-[10px] text-gray-400">
          {ticksMemo.map(t => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}


