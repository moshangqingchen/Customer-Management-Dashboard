import { Check, Copy } from 'lucide-react';
import { useCopy } from '../../hooks/useCopy';
import { IconButton } from './Button';

export function CopyButton({ value, label = '复制', size = 'sm' }: { value: string; label?: string; size?: 'sm' | 'md' | 'lg' }) { const { copy, copied } = useCopy(); return <IconButton size={size} label={copied ? '已复制' : label} className={copied ? 'text-success-fg' : ''} onClick={event => { event.stopPropagation(); void copy(value); }}>{copied ? <Check size={16} /> : <Copy size={16} />}</IconButton>; }
