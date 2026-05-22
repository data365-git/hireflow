"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ComboboxOption = string | {
  label: string;
  value?: string;
  region?: string;
};

type ComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: readonly ComboboxOption[];
  placeholder?: string;
  className?: string;
  allowCustom?: boolean;
};

type NormalizedOption = {
  label: string;
  value: string;
  region?: string;
};

function normalizeOption(option: ComboboxOption): NormalizedOption {
  if (typeof option === "string") {
    return { label: option, value: option };
  }

  return {
    label: option.label,
    value: option.value ?? option.label,
    region: option.region,
  };
}

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

  const normalizedOptions = useMemo(
    () => options.map(normalizeOption),
    [options]
  );

  const filteredOptions = useMemo(() => {
    const query = value.trim().toLowerCase();
    const matches = query
      ? normalizedOptions.filter((option) => {
          const label = option.label.toLowerCase();
          const region = option.region?.toLowerCase() ?? "";
          return label.includes(query) || region.includes(query);
        })
      : normalizedOptions;
    return matches.slice(0, 50);
  }, [normalizedOptions, value]);

  const groupedOptions = useMemo(() => {
    const groups: { region?: string; options: NormalizedOption[] }[] = [];

    for (const option of filteredOptions) {
      const region = option.region;
      const group = groups.find((item) => item.region === region);
      if (group) {
        group.options.push(option);
      } else {
        groups.push({ region, options: [option] });
      }
    }

    return groups;
  }, [filteredOptions]);

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
      onChange(filteredOptions[0].value);
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
          if (event.key === "Enter" || event.key === "Tab") {
            if (event.key === "Enter") event.preventDefault();
            commitFirstOption();
          }
        }}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
      />
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-surface shadow-lg">
          {groupedOptions.map((group) => (
            <div key={group.region ?? "options"}>
              {group.region && (
                <div className="sticky top-0 bg-surface px-3 py-1.5 text-micro uppercase tracking-wider text-subtle">
                  {group.region}
                </div>
              )}
              {group.options.map((option) => (
                <button
                  key={`${option.region ?? "option"}-${option.value}`}
                  type="button"
                  className="block w-full px-3 py-2 text-left text-body-sm text-text hover:bg-surface-2"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
