"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  className?: string;
  allowCustom?: boolean;
};

export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  className,
  allowCustom = false,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    const query = value.trim().toLowerCase();
    const matches = query
      ? options.filter((option) => option.toLowerCase().includes(query))
      : options;
    return matches.slice(0, 8);
  }, [options, value]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function commitFirstOption() {
    if (filteredOptions[0]) {
      onChange(filteredOptions[0]);
      setIsOpen(false);
    } else if (allowCustom) {
      setIsOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        className={className}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setIsOpen(false);
          if (event.key === "Enter" || event.key === "Tab") commitFirstOption();
        }}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
      />
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-surface shadow-lg">
          {filteredOptions.map((option) => (
            <button
              key={option}
              type="button"
              className="block w-full px-3 py-2 text-left text-body-sm text-text hover:bg-surface-2"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
