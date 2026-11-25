'use client';
import { useEffect, useRef } from 'react';

/** Avoid browser-localized/reversed date segments: always display canonical ISO. */
export default function DateField({ value, onChange, label, className = '' }: {
  value: string; onChange: (value: string) => void; label?: string; className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let valid = !value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith('0000')) {
      const date = new Date(`${value}T00:00:00Z`);
      valid = !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }
    input.current?.setCustomValidity(valid ? '' : 'YYYY-MM-DD');
  }, [value]);
  return <input ref={input} type="text" lang="en" dir="ltr" inputMode="numeric" aria-label={label}
    placeholder="YYYY-MM-DD" maxLength={10} pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
    value={value} onChange={(event) => onChange(event.target.value)} className={`field iso-date ${className}`} />;
}
