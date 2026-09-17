import { ALargeSmall, Minus, Plus, RotateCcw, X } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import {
  DEFAULT_EPUB_PREFERENCES,
  type EpubPreferences,
  type FontFamily,
  type FontWeight,
  type TextAlignment,
} from "@/app/read/[...key]/features/appearance/epub-preferences";
import { BUTTON_ROUND, SELECT } from "@/app/ui";

export function EpubSettings({
  preferences,
  open,
  onOpenChange,
  onChange,
}: {
  preferences: EpubPreferences;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (preferences: EpubPreferences) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onOpenChange]);

  const update = <Key extends keyof EpubPreferences>(
    key: Key,
    value: EpubPreferences[Key],
  ) => onChange({ ...preferences, [key]: value });

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label="Text and page settings"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={BUTTON_ROUND}
      >
        <ALargeSmall aria-hidden="true" className="size-4" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close text and page settings"
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-20 bg-black/15 sm:bg-transparent"
          />
          <section
            role="dialog"
            aria-label="Text and page settings"
            className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-separator bg-surface p-5 shadow-page sm:absolute sm:inset-x-auto sm:bottom-full sm:right-0 sm:mb-3 sm:w-88 sm:max-w-[calc(100vw-2rem)]"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Reading settings</h2>
              <button
                type="button"
                aria-label="Close settings"
                onClick={() => onOpenChange(false)}
                className="inline-flex size-11 items-center justify-center rounded-full text-secondary transition-colors hover:bg-fill hover:text-foreground sm:hidden"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>

            <SettingsGroup title="Text">
              <Setting label="Font size" value={`${preferences.fontSize}%`}>
                <div className="flex items-center gap-2">
                  <StepButton
                    label="Decrease font size"
                    onClick={() =>
                      update("fontSize", Math.max(75, preferences.fontSize - 5))
                    }
                  >
                    <Minus aria-hidden="true" className="size-3.5" />
                  </StepButton>
                  <input
                    aria-label="Font size"
                    type="range"
                    min="75"
                    max="200"
                    step="5"
                    value={preferences.fontSize}
                    onChange={(event) =>
                      update("fontSize", Number(event.target.value))
                    }
                    className="min-w-0 flex-1 accent-accent"
                  />
                  <StepButton
                    label="Increase font size"
                    onClick={() =>
                      update(
                        "fontSize",
                        Math.min(200, preferences.fontSize + 5),
                      )
                    }
                  >
                    <Plus aria-hidden="true" className="size-3.5" />
                  </StepButton>
                </div>
              </Setting>

              <SelectSetting
                label="Font family"
                value={preferences.fontFamily}
                onChange={(value) => update("fontFamily", value as FontFamily)}
                options={[
                  ["publisher", "Publisher"],
                  ["serif", "Serif"],
                  ["sans", "Sans serif"],
                ]}
              />
              <SelectSetting
                label="Font weight"
                value={preferences.fontWeight}
                onChange={(value) => update("fontWeight", value as FontWeight)}
                options={[
                  ["publisher", "Publisher"],
                  ["400", "Regular"],
                  ["500", "Medium"],
                  ["600", "Semibold"],
                  ["700", "Bold"],
                ]}
              />
              <RangeSetting
                label="Line height"
                value={preferences.lineHeight}
                shown={preferences.lineHeight.toFixed(2)}
                min={1.1}
                max={2}
                step={0.05}
                onChange={(value) => update("lineHeight", value)}
              />
              <RangeSetting
                label="Paragraph spacing"
                value={preferences.paragraphSpacing}
                shown={`${preferences.paragraphSpacing.toFixed(1)}em`}
                min={0}
                max={1.5}
                step={0.1}
                onChange={(value) => update("paragraphSpacing", value)}
              />
              <RangeSetting
                label="Letter spacing"
                value={preferences.letterSpacing}
                shown={`${preferences.letterSpacing.toFixed(2)}em`}
                min={-0.03}
                max={0.12}
                step={0.01}
                onChange={(value) => update("letterSpacing", value)}
              />
              <SelectSetting
                label="Text alignment"
                value={preferences.textAlignment}
                onChange={(value) =>
                  update("textAlignment", value as TextAlignment)
                }
                options={[
                  ["publisher", "Publisher"],
                  ["start", "Left / start"],
                  ["justify", "Justified"],
                ]}
              />
            </SettingsGroup>

            <SettingsGroup title="Page">
              <SelectSetting
                label="View"
                value={preferences.view}
                onChange={(value) =>
                  update("view", value as EpubPreferences["view"])
                }
                options={[
                  ["paged", "Paged"],
                  ["scroll", "Continuous scroll"],
                ]}
              />
              <RangeSetting
                label="Margin"
                value={preferences.margin}
                shown={`${preferences.margin}px`}
                min={8}
                max={64}
                step={4}
                onChange={(value) => update("margin", value)}
              />
              <RangeSetting
                label="Maximum text width"
                value={preferences.maxTextWidth}
                shown={`${preferences.maxTextWidth}ch`}
                min={45}
                max={90}
                step={1}
                onChange={(value) => update("maxTextWidth", value)}
              />
              <SelectSetting
                label="Columns"
                value={preferences.columns}
                disabled={preferences.view === "scroll"}
                onChange={(value) =>
                  update("columns", value as EpubPreferences["columns"])
                }
                options={[
                  ["auto", "Automatic"],
                  ["one", "One"],
                  ["two", "Two"],
                ]}
              />
            </SettingsGroup>

            <button
              type="button"
              onClick={() => onChange(DEFAULT_EPUB_PREFERENCES)}
              className="mt-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-secondary transition-colors hover:bg-fill hover:text-foreground"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
              Reset settings
            </button>
          </section>
        </>
      )}
    </div>
  );
}

function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="mt-4 border-t border-separator pt-3 first:mt-0 first:border-0 first:pt-0">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-secondary">
        {title}
      </legend>
      <div className="divide-y divide-separator">{children}</div>
    </fieldset>
  );
}

function Setting({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: ReactNode;
}) {
  return (
    <div className="py-3 first:pt-2">
      <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        {value && <span className="tabular-nums text-secondary">{value}</span>}
      </div>
      {children}
    </div>
  );
}

function RangeSetting({
  label,
  shown,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  shown: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <Setting label={label} value={shown}>
      <input
        aria-label={label}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="block w-full accent-accent"
      />
    </Setting>
  );
}

function SelectSetting({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-3 text-sm first:pt-2">
      <span className={disabled ? "text-tertiary" : "font-medium"}>
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`${SELECT} min-w-32 disabled:cursor-not-allowed disabled:opacity-45`}
      >
        {options.map(([option, optionLabel]) => (
          <option key={option} value={option}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-fill transition-colors hover:bg-fill-hover"
    >
      {children}
    </button>
  );
}
