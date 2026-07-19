"use client";

import * as React from "react";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { useT } from "@open-mercato/shared/lib/i18n/context";
import { Button } from "@open-mercato/ui/primitives/button";
import { Label } from "@open-mercato/ui/primitives/label";
import {
  CRUD_FORM_SELECT_CLASS,
  CRUD_FORM_TEXT_INPUT_CLASS,
} from "@open-mercato/ui/backend/CrudForm";
import { EntitySearchCombobox } from "@open-mercato/ui/backend/inputs/EntitySearchCombobox";
import { mergeEntitySearchOption } from "@open-mercato/core/modules/procurement/lib/procurementEntitySearch";
import {
  remoteSearchPlaybooksForCase,
  resolvePlaybookTitleVersion,
} from "@open-mercato/core/modules/cases/lib/caseRelationsSearch";
import { formatProcedurePlaybookLabel } from "@open-mercato/core/modules/cases/lib/formatProcedurePlaybookLabel";
import {
  createProductCaseTemplateDraft,
  type ProductCaseTemplateDraft,
  type ProductCaseTemplateRecurrenceUnit,
} from "./productForm";

const RECURRENCE_UNITS: ProductCaseTemplateRecurrenceUnit[] = [
  "hours",
  "days",
  "weeks",
  "months",
];

type ProductCaseTemplatesEditorProps = {
  value: ProductCaseTemplateDraft[];
  onChange: (next: ProductCaseTemplateDraft[]) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
};

type PlaybookPickerProps = {
  value: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
};

function PlaybookPicker({ value, onChange, disabled }: PlaybookPickerProps) {
  const t = useT();
  const playbookId = typeof value === "string" ? value : "";
  const [playbookLabel, setPlaybookLabel] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    if (
      !playbookId.trim().length ||
      !z.string().uuid().safeParse(playbookId.trim()).success
    ) {
      setPlaybookLabel("");
      return;
    }
    void resolvePlaybookTitleVersion(playbookId.trim()).then((row) => {
      if (!cancelled) {
        setPlaybookLabel(
          row ? formatProcedurePlaybookLabel(row.title, row.version, t) : "",
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [playbookId, t]);

  const resolvedMergeLabel = playbookLabel.trim().length
    ? playbookLabel
    : playbookId;

  return (
    <EntitySearchCombobox
      value={playbookId}
      onChange={(next) => onChange(next.trim().length ? next.trim() : null)}
      options={mergeEntitySearchOption([], playbookId, resolvedMergeLabel)}
      onRemoteSearch={async (query) => {
        const rows = await remoteSearchPlaybooksForCase(query, (title, version) =>
          formatProcedurePlaybookLabel(title, version ?? null, t),
        );
        return mergeEntitySearchOption(rows, playbookId, resolvedMergeLabel);
      }}
      placeholder={t(
        "catalog.products.caseTemplates.playbookSearch",
        "Search procedures…",
      )}
      disabled={disabled}
      createInNewTabHref="/backend/playbooks/create"
      createInNewTabAriaLabel={t(
        "catalog.products.caseTemplates.openNewPlaybookTab",
        "Open new procedure in a new tab",
      )}
    />
  );
}

export function ProductCaseTemplatesEditor({
  value,
  onChange,
  errors,
  disabled,
}: ProductCaseTemplatesEditorProps) {
  const t = useT();
  const templates = Array.isArray(value) ? value : [];

  const updateTemplate = React.useCallback(
    (
      templateId: string,
      patch: Partial<ProductCaseTemplateDraft>,
    ) => {
      onChange(
        templates.map((entry) =>
          entry.id === templateId ? { ...entry, ...patch } : entry,
        ),
      );
    },
    [onChange, templates],
  );

  const removeTemplate = React.useCallback(
    (templateId: string) => {
      onChange(templates.filter((entry) => entry.id !== templateId));
    },
    [onChange, templates],
  );

  const addTemplate = React.useCallback(() => {
    onChange([...templates, createProductCaseTemplateDraft()]);
  }, [onChange, templates]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label className="text-sm font-medium">
            {t("catalog.products.caseTemplates.title", "Case templates")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t(
              "catalog.products.caseTemplates.description",
              "Cases created when this offering is activated for a customer.",
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addTemplate}
          disabled={disabled}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {t("catalog.products.caseTemplates.add", "Add template")}
        </Button>
      </div>

      {!templates.length ? (
        <p className="text-sm text-muted-foreground">
          {t(
            "catalog.products.caseTemplates.empty",
            "No case templates yet. Add one to spawn cases on activation.",
          )}
        </p>
      ) : null}

      {templates.map((template, index) => {
        const titleError = errors?.[`caseTemplates[${index}].title`];
        return (
          <div
            key={template.id}
            className="space-y-3 rounded-lg border bg-muted/20 p-4"
          >
            <div className="flex items-start gap-2">
              <div className="grid flex-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    {t(
                      "catalog.products.caseTemplates.templateTitle",
                      "Template title",
                    )}
                    <span className="text-red-600"> *</span>
                  </label>
                  <input
                    type="text"
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    value={template.title}
                    onChange={(event) =>
                      updateTemplate(template.id, { title: event.target.value })
                    }
                    placeholder={t(
                      "catalog.products.caseTemplates.templateTitlePlaceholder",
                      "e.g., Onboarding review",
                    )}
                    disabled={disabled}
                  />
                  {titleError ? (
                    <p className="text-xs text-red-600">{titleError}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    {t("catalog.products.caseTemplates.playbook", "Procedure")}
                  </label>
                  <PlaybookPicker
                    value={template.playbookId}
                    onChange={(next) =>
                      updateTemplate(template.id, { playbookId: next })
                    }
                    disabled={disabled}
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeTemplate(template.id)}
                disabled={disabled}
                title={t(
                  "catalog.products.caseTemplates.remove",
                  "Remove template",
                )}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border"
                checked={template.recurrenceEnabled}
                onChange={(event) =>
                  updateTemplate(template.id, {
                    recurrenceEnabled: event.target.checked,
                  })
                }
                disabled={disabled}
              />
              {t(
                "catalog.products.caseTemplates.recurrenceEnabled",
                "Recurring case",
              )}
            </label>

            {template.recurrenceEnabled ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    {t(
                      "catalog.products.caseTemplates.recurrenceInterval",
                      "Repeat every",
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      className={CRUD_FORM_TEXT_INPUT_CLASS}
                      value={template.recurrenceIntervalAmount}
                      onChange={(event) =>
                        updateTemplate(template.id, {
                          recurrenceIntervalAmount: event.target.value,
                        })
                      }
                      placeholder="1"
                      disabled={disabled}
                    />
                    <select
                      className={CRUD_FORM_SELECT_CLASS}
                      value={template.recurrenceIntervalUnit ?? ""}
                      onChange={(event) =>
                        updateTemplate(template.id, {
                          recurrenceIntervalUnit:
                            parseRecurrenceUnit(event.target.value),
                        })
                      }
                      disabled={disabled}
                    >
                      <option value="">
                        {t(
                          "catalog.products.caseTemplates.recurrenceUnitPlaceholder",
                          "Unit",
                        )}
                      </option>
                      {RECURRENCE_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {t(
                            `catalog.products.caseTemplates.recurrenceUnits.${unit}`,
                            unit,
                          )}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    {t(
                      "catalog.products.caseTemplates.recurrenceLeadTime",
                      "Create lead time (optional)",
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      className={CRUD_FORM_TEXT_INPUT_CLASS}
                      value={template.recurrenceLeadTimeAmount}
                      onChange={(event) =>
                        updateTemplate(template.id, {
                          recurrenceLeadTimeAmount: event.target.value,
                        })
                      }
                      placeholder="0"
                      disabled={disabled}
                    />
                    <select
                      className={CRUD_FORM_SELECT_CLASS}
                      value={template.recurrenceLeadTimeUnit ?? ""}
                      onChange={(event) =>
                        updateTemplate(template.id, {
                          recurrenceLeadTimeUnit:
                            parseRecurrenceUnit(event.target.value),
                        })
                      }
                      disabled={disabled}
                    >
                      <option value="">
                        {t(
                          "catalog.products.caseTemplates.recurrenceUnitPlaceholder",
                          "Unit",
                        )}
                      </option>
                      {RECURRENCE_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {t(
                            `catalog.products.caseTemplates.recurrenceUnits.${unit}`,
                            unit,
                          )}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "catalog.products.caseTemplates.recurrenceLeadTimeHelp",
                      "How long before the next occurrence to create the case.",
                    )}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function parseRecurrenceUnit(
  raw: string,
): ProductCaseTemplateRecurrenceUnit | null {
  const trimmed = raw.trim();
  return (RECURRENCE_UNITS as readonly string[]).includes(trimmed)
    ? (trimmed as ProductCaseTemplateRecurrenceUnit)
    : null;
}
