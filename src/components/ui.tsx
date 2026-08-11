import { useEffect, useId, useMemo, useRef, useState, type ButtonHTMLAttributes, type PropsWithChildren, type ReactNode } from "react";
import { ChevronDown, Star, X } from "lucide-react";

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

export type SearchableSelectOption = string | { value: string; label: string };

function searchableOption(option: SearchableSelectOption) {
  return typeof option === "string" ? { value: option, label: option } : option;
}

export function SearchableSelect({
  ariaLabel,
  value,
  options,
  onChange,
  placeholder = "输入关键字筛选",
  className = "",
  disabled = false,
}: {
  ariaLabel: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const normalizedOptions = useMemo(() => options.map(searchableOption), [options]);
  const selectedLabel = normalizedOptions.find((option) => option.value === value)?.label ?? value;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selectedLabel);
  const [showAllOptions, setShowAllOptions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const closeTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!open) {
      setQuery(selectedLabel);
      setShowAllOptions(false);
    }
  }, [open, selectedLabel]);

  const trimmedQuery = query.trim().toLowerCase();
  const filteredOptions = showAllOptions ? normalizedOptions : normalizedOptions.filter((option) => {
    if (!trimmedQuery) return true;
    return option.label.toLowerCase().includes(trimmedQuery) || option.value.toLowerCase().includes(trimmedQuery);
  });

  useEffect(() => {
    if (!open) return;
    const selectedIndex = filteredOptions.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, query, showAllOptions, value, filteredOptions.length]);

  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

  const selectOption = (nextValue: string) => {
    const option = normalizedOptions.find((item) => item.value === nextValue);
    onChange(nextValue);
    setQuery(option?.label ?? nextValue);
    setOpen(false);
    setShowAllOptions(false);
  };

  const close = () => {
    const exact = normalizedOptions.find((option) => option.label === query || option.value === query);
    if (exact && exact.value !== value) {
      selectOption(exact.value);
      return;
    }
    setOpen(false);
    setShowAllOptions(false);
    setQuery(selectedLabel);
  };

  return (
    <div className={`searchable-select ${className}`}>
      <input
        ref={inputRef}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={open && filteredOptions[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
        data-options={normalizedOptions.map((option) => option.label).join("\n")}
        disabled={disabled}
        role="combobox"
        value={query}
        placeholder={selectedLabel || placeholder}
        onFocus={(event) => {
          if (closeTimer.current) window.clearTimeout(closeTimer.current);
          setShowAllOptions(true);
          setOpen(true);
          event.currentTarget.select();
        }}
        onBlur={() => {
          closeTimer.current = window.setTimeout(close, 120);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setShowAllOptions(false);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => {
              if (!filteredOptions.length) return 0;
              const offset = event.key === "ArrowDown" ? 1 : -1;
              return (current + offset + filteredOptions.length) % filteredOptions.length;
            });
          }
          if (event.key === "Home" && open) {
            event.preventDefault();
            setActiveIndex(0);
          }
          if (event.key === "End" && open) {
            event.preventDefault();
            setActiveIndex(Math.max(0, filteredOptions.length - 1));
          }
          if (event.key === "Enter") {
            event.preventDefault();
            const exact = normalizedOptions.find((option) => option.label === query || option.value === query);
            const next = (open ? filteredOptions[activeIndex] : undefined) ?? exact ?? filteredOptions[0];
            if (next) selectOption(next.value);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            setShowAllOptions(false);
            setQuery(selectedLabel);
          }
        }}
      />
      <button
        type="button"
        className="searchable-select-toggle"
        aria-label={`${ariaLabel}下拉选项`}
        disabled={disabled}
        onMouseDown={(event) => {
          event.preventDefault();
          if (closeTimer.current) window.clearTimeout(closeTimer.current);
          setQuery(selectedLabel);
          setShowAllOptions(true);
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="searchable-select-menu" id={listboxId} role="listbox">
          {filteredOptions.length ? filteredOptions.map((option, index) => (
            <div
              className={index === activeIndex ? "active" : ""}
              id={`${listboxId}-${index}`}
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                selectOption(option.value);
              }}
            >
              {option.label}
            </div>
          )) : <div className="empty" role="note">没有匹配选项</div>}
        </div>
      )}
    </div>
  );
}

export function StarRating({ value, onChange, compact = false }: { value: number; onChange?: (value: number) => void; compact?: boolean }) {
  return (
    <div className={`star-rating ${compact ? "compact" : ""}`} role="group" aria-label={`${value} 星 VIP`}>
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
  const cardRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const subtitleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const card = cardRef.current;
    const focusableSelector = [
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "a[href]",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");
    const focusFirst = window.requestAnimationFrame(() => {
      const preferred = card?.querySelector<HTMLElement>("[autofocus]");
      (preferred ?? card?.querySelector<HTMLElement>(focusableSelector) ?? card)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !closeDisabled) {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !card) return;
      const focusable = Array.from(card.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) {
        event.preventDefault();
        card.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusFirst);
      document.removeEventListener("keydown", handleKeyDown, true);
      previousFocusRef.current?.focus();
    };
  }, [closeDisabled]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={closeDisabled ? undefined : (event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={cardRef}
        className={`modal-card ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
      >
        <header className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p id={subtitleId}>{subtitle}</p>}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭" disabled={closeDisabled}>
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
