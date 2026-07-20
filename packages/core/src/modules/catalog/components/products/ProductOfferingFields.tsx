"use client";

import * as React from "react";
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
  return (
    <div className="space-y-4">
      <ProductCaseTemplatesEditor
        value={Array.isArray(values.caseTemplates) ? values.caseTemplates : []}
        onChange={(next) => setValue("caseTemplates", next)}
        errors={errors}
        disabled={disabled}
      />
    </div>
  );
}
