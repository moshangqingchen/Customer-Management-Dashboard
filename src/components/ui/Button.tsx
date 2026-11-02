import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Tooltip } from './Tooltip';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger'; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode };
const variants = { primary: 'border-transparent bg-primary-gradient text-primary-fg shadow-primary hover:brightness-106 hover:shadow-md', secondary: 'border-line bg-surface text-fg hover:bg-hover', ghost: 'border-transparent bg-transparent text-fg-2 hover:bg-hover hover:text-fg', soft: 'border-transparent bg-primary-soft text-primary hover:bg-active', danger: 'border-danger-border bg-danger-bg text-danger-fg hover:opacity-80' };
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...props }, ref) {
  return <button ref={ref} type={type} className={cn('inline-flex shrink-0 items-center justify-center gap-2 rounded-md border font-medium whitespace-nowrap transition-all transition-sky active:scale-98 disabled:pointer-events-none disabled:opacity-45', variants[variant], { sm: 'h-8 px-3 text-sm', md: 'h-[38px] px-4 text-base', lg: 'h-11 px-5 text-input' }[size], className)} {...props}>{icon}{children}</button>;
});
export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'icon'> & { label: string }>(function IconButton({ label, children, className, size = 'md', variant = 'ghost', ...props }, ref) {
  return <Tooltip content={label}><Button ref={ref} aria-label={label} variant={variant} size={size} className={cn('p-0', { sm: 'w-8', md: 'w-[38px]', lg: 'w-11' }[size], className)} {...props}>{children}</Button></Tooltip>;
});
