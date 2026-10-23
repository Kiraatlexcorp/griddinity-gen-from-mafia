"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
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
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select
        items={options}
        value={value}
        onValueChange={(next) => {
          if (next != null) onChange(next as T);
        }}
      >
        <SelectTrigger className="w-full">
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
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}

function firstNumber(value: number | readonly number[]) {
  return typeof value === "number" ? value : value[0];
}

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
  const text = focused ? override : printed;

  function commit(next: number) {
    if (!Number.isFinite(next)) return;
    onChange(Math.min(max, Math.max(min, next)));
  }

  return (
    <Field>
      <div className="flex items-baseline justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
          {suffix}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Slider
          className="min-w-0 flex-1"
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={(next) => {
            const picked = firstNumber(next);
            if (picked != null) commit(picked);
          }}
        />
        <Input
          className="w-[4.75rem] text-right font-mono tabular-nums"
          inputMode="decimal"
          type="number"
          min={min}
          max={max}
          step={step}
          value={text}
          onFocus={() => {
            setOverride(printed);
            setFocused(true);
          }}
          onChange={(event) => {
            setOverride(event.target.value);
            const parsed = Number(event.target.value);
            if (event.target.value.trim() !== "" && Number.isFinite(parsed)) commit(parsed);
          }}
          onBlur={() => {
            const parsed = Number(override);
            setFocused(false);
            if (Number.isFinite(parsed)) commit(parsed);
          }}
        />
      </div>
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}

