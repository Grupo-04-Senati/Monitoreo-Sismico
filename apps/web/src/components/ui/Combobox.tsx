import { useEffect, useRef, useState } from "react";

export interface ComboOption {
  value: string;
  label: string;
  hint?: string;
}

interface ComboboxProps {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  emptyText?: string;
  className?: string;
}

/* Quita acentos y pasa a minúsculas para buscar escribiendo sin tildes */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Campo de texto con autocompletado: se escribe a mano y aparecen las opciones.
 * Navegación con ↑ ↓ Enter y Esc; sin dependencias externas.
 */
export default function Combobox({
  options,
  value,
  onChange,
  placeholder,
  ariaLabel,
  emptyText = "Sin coincidencias",
  className = "",
}: ComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    setQuery(selected ? selected.label : "");
  }, [selected]);

  useEffect(() => {
    const onDown = (ev: MouseEvent) => {
      if (!wrapRef.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const q = norm(query.trim());
  const filtered = q
    ? options.filter((o) => norm(o.label).includes(q) || norm(o.hint ?? "").includes(q))
    : options;
  const visible = filtered.slice(0, 8);

  const commit = (opt: ComboOption) => {
    onChange(opt.value);
    setQuery(opt.label);
    setOpen(false);
    setActive(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, visible.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (open && visible[active]) {
        e.preventDefault();
        commit(visible[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.stopPropagation();
        setOpen(false);
      }
    }
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div className="flex items-center gap-1 px-2 py-1.5 text-xs bg-surface border border-border rounded-md focus-within:border-accent-500">
        <input
          type="text"
          value={query}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="w-full bg-transparent text-content placeholder:text-content-muted focus:outline-none"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
            if (!e.target.value) onChange("");
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setQuery("");
              setOpen(false);
            }}
            className="shrink-0 px-1 text-content-muted hover:text-content"
            aria-label="Limpiar selección"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto bg-surface border border-border rounded-md shadow-lg py-1"
        >
          {visible.length === 0 ? (
            <li className="px-3 py-1.5 text-xs text-content-muted">{emptyText}</li>
          ) : (
            visible.map((o, i) => (
              <li key={`${o.value}-${o.label}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(o);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                    i === active ? "bg-surface-tertiary text-content" : "text-content-secondary"
                  } ${o.value === value ? "font-semibold" : ""}`}
                >
                  <span className="text-content">{o.label}</span>
                  {o.hint && <span className="ml-auto text-[11px] text-content-muted">{o.hint}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
