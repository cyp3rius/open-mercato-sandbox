"use client";

import * as React from "react";
import { useT } from "@open-mercato/shared/lib/i18n/context";
import { Label } from "@open-mercato/ui/primitives/label";
import { CRUD_FORM_SELECT_CLASS } from "@open-mercato/ui/backend/CrudForm";
import {
  CATALOG_OFFERING_KINDS,
  type CatalogOfferingKind,
} from "../../data/types";
import type { ProductFormValues } from "./productForm";
import { ProductCaseTemplatesEditor } from "./ProductCaseTemplatesEditor";

type ProductOfferingFieldsProps = {
  values: ProductFormValues;
  setValue: (id: string, value: unknown) => void;
  errors: Record<string, string>;
  disabled?: boolean;
};

export function ProductOfferingFields({
  values,
  setValue,
  errors,
  disabled,
}: ProductOfferingFieldsProps) {
  const t = useT();
  const offeringKind = values.offeringKind ?? "internal_service";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>
          {t("catalog.products.form.offeringKind", "Offering kind")}
        </Label>
        <select
          className={CRUD_FORM_SELECT_CLASS}
          value={offeringKind}
          onChange={(event) =>
            setValue("offeringKind", event.target.value as CatalogOfferingKind)
          }
          disabled={disabled}
        >
          {CATALOG_OFFERING_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`catalog.products.offeringKinds.${kind}`, kind)}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {t(
            "catalog.products.form.offeringKindHelp",
            "Commercial offering type used when the product is sold and activated for customers.",
          )}
        </p>
        {errors.offeringKind ? (
          <p className="text-xs text-red-600">{errors.offeringKind}</p>
        ) : null}
      </div>

      <ProductCaseTemplatesEditor
        value={Array.isArray(values.caseTemplates) ? values.caseTemplates : []}
        onChange={(next) => setValue("caseTemplates", next)}
        errors={errors}
        disabled={disabled}
      />
    </div>
  );
}
