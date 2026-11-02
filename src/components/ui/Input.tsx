import { forwardRef, useEffect, useId, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { parseMoney } from '../../lib/money';

export const inputClass = 'w-full rounded-md border border-line bg-subtle px-3 text-input text-fg placeholder:text-fg-3 transition-colors transition-sky hover:border-line-strong focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-focus/40 disabled:opacity-45 disabled:cursor-not-allowed aria-invalid:border-danger-fg';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) { return <input ref={ref} className={cn(inputClass, 'h-[38px]', className)} {...props} />; });
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) { return <textarea ref={ref} className={cn(inputClass, 'min-h-24 resize-y py-2', className)} {...props} />; });
export type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & { value: number; onChange: (cents: number) => void; label?: string };
export function NumberInput({ value, onChange, label, id, onBlur, ...props }: NumberInputProps) {
  const generated = useId(); const inputId = id ?? generated;
  const [text, setText] = useState(String(value / 100)); const [invalid, setInvalid] = useState(false);
  useEffect(() => { setText(String(value / 100)); setInvalid(false); }, [value]);
  return <div>{label && <label htmlFor={inputId} className="mb-1 block text-sm text-fg-2">{label}</label>}<div className="relative"><span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-2">¥</span><Input {...props} id={inputId} inputMode="decimal" value={text} aria-label={props['aria-label'] ?? (label || props['aria-labelledby'] ? undefined : '金额（元）')} aria-invalid={invalid} className={cn('pl-7 tabular-nums', props.className)} onChange={event => { const next = event.target.value; setText(next); const cents = parseMoney(next); const valid = cents !== null && cents >= 0; setInvalid(!valid); if (valid) onChange(cents); }} onBlur={event => { setText(String(value / 100)); setInvalid(false); onBlur?.(event); }} /></div>{invalid && <p role="alert" className="mt-1 text-xs text-danger-fg">请输入非负金额，最多两位小数</p>}</div>;
}
