import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from "react";
import { Star, X } from "lucide-react";

import { getStatusTone } from "../lib/format";

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }>) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function StatusBadge({ value }: { value: string }) {
  return <span className={`status-badge tone-${getStatusTone(value)}`}>{value}</span>;
}

export function StarRating({ value, onChange, compact = false }: { value: number; onChange?: (value: number) => void; compact?: boolean }) {
  return (
    <div className={`star-rating ${compact ? "compact" : ""}`} aria-label={`${value} 星 VIP`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          type="button"
          key={star}
          className={star <= value ? "active" : ""}
          onClick={() => onChange?.(star === value ? 0 : star)}
          disabled={!onChange}
          aria-label={`${star} 星`}
        >
          <Star size={compact ? 13 : 18} fill="currentColor" />
        </button>
      ))}
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
  closeDisabled = false,
}: PropsWithChildren<{ title: string; subtitle?: string; onClose: () => void; wide?: boolean; closeDisabled?: boolean }>) {
  return (
    <div className="modal-backdrop" onMouseDown={closeDisabled ? undefined : onClose}>
      <section className={`modal-card ${wide ? "wide" : ""}`} onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭" disabled={closeDisabled}>
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
