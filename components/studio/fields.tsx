"use client";

import { useRef, useState } from "react";
import { formatMm } from "@/lib/params";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export function SwitchField({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Field orientation="horizontal" data-disabled={disabled || undefined}>
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      </FieldContent>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onChange(next)}
      />
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <Field className="gap-1">
      <div data-slot="tune-row" className="tune-row">
      <FieldLabel className="tune-row-label">{label}</FieldLabel>
      <Select
        items={options}
        value={value}
        onValueChange={(next) => {
          if (next != null) onChange(next as T);
        }}
      >
        <SelectTrigger size="sm" className="tune-select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      </div>
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}

/**
 * Fine-tune number field (beautifului.dev FineTuneCard ScrubField): an inset filled
 * box with a muted inline label prefix and unit suffix. Drag the label to scrub,
 * use the arrow keys on it (Shift for x10), or type in the value.
 */
export function MeasureField({
  label,
  hint,
  value,
  min,
  max,
  step,
  digits,
  suffix,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  digits: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  const printed = digits === 0 ? String(Math.round(value)) : formatMm(value);
  const [focused, setFocused] = useState(false);
  const [override, setOverride] = useState(printed);
  const drag = useRef<{ x: number; v: number } | null>(null);
  const text = focused ? override : printed;
  const unit = suffix.toLowerCase();

  function commit(next: number) {
    if (!Number.isFinite(next)) return;
    const snapped = Math.round(next / step) * step;
    onChange(Math.min(max, Math.max(min, Number(snapped.toFixed(4)))));
  }

  return (
    <Field className="gap-1">
      <label data-slot="tune-field" className="tune-field">
        <span
          role="slider"
          aria-label={label}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          tabIndex={0}
          className="tune-field-label"
          onPointerDown={(event) => {
            (event.target as HTMLElement).setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX, v: value };
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            commit(drag.current.v + ((event.clientX - drag.current.x) / 2) * step);
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={(event) => {
            const mult = event.shiftKey ? 10 : 1;
            if (event.key === "ArrowUp" || event.key === "ArrowRight") {
              event.preventDefault();
              commit(value + step * mult);
            } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
              event.preventDefault();
              commit(value - step * mult);
            }
          }}
        >
          {label}
        </span>
        <input
          className="tune-field-input"
          inputMode="decimal"
          aria-label={`${label} value`}
          value={text}
          onFocus={() => {
            setOverride(printed);
            setFocused(true);
          }}
          onChange={(event) => {
            setOverride(event.target.value);
            const parsed = Number(event.target.value);
            if (event.target.value.trim() !== "" && Number.isFinite(parsed)) {
              onChange(Math.min(max, Math.max(min, parsed)));
            }
          }}
          onBlur={() => {
            const parsed = Number(override);
            setFocused(false);
            if (override.trim() !== "" && Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
          }}
        />
        {unit ? <span className="tune-field-unit">{unit}</span> : null}
      </label>
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}
