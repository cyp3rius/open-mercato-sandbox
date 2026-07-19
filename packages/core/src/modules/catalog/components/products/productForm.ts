import { z } from "zod";
import { slugify } from "@open-mercato/shared/lib/slugify";
import { parseObjectLike } from "@open-mercato/shared/lib/json/parseObjectLike";
import type { ReferenceUnitCode } from "@open-mercato/shared/lib/units/unitCodes";
import {
  CATALOG_CONFIGURABLE_PRODUCT_TYPES,
  CATALOG_OFFERING_KINDS,
  type CatalogOfferingKind,
  type CatalogProductCaseTemplate,
  type CatalogProductOptionSchema,
  type CatalogProductType,
} from "../../data/types";
import type { ProductMediaItem } from "./ProductMediaManager";

export { slugify };

export type PriceKindSummary = {
  id: string;
  code: string;
  title: string;
  currencyCode: string | null;
  displayMode: "including-tax" | "excluding-tax";
};

export type PriceKindApiPayload = {
  id?: string | number;
  code?: string;
  title?: string;
  currencyCode?: string | null;
  currency_code?: string | null;
  displayMode?: string | null;
  display_mode?: string | null;
};

export type TaxRateSummary = {
  id: string;
  name: string;
  code: string | null;
  rate: number | null;
  isDefault: boolean;
};

export type ServiceLineSummary = {
  id: string;
  code: string;
  title: string;
  isActive: boolean;
};

export type ProductOptionInput = {
  id: string;
  title: string;
  values: Array<{ id: string; label: string }>;
};

export type ProductDimensions = {
  width?: number;
  height?: number;
  depth?: number;
  unit?: string | null;
} | null;

export type ProductWeight = {
  value?: number;
  unit?: string | null;
} | null;

export type VariantPriceValue = {
  amount: string;
};

export type ProductUnitRoundingMode = "half_up" | "down" | "up";
export type ProductUnitPriceReferenceUnit = ReferenceUnitCode;

export type ProductUnitConversionDraft = {
  id: string | null;
  unitCode: string;
  toBaseFactor: string;
  sortOrder: string;
  isActive: boolean;
};

export type ProductCaseTemplateRecurrenceUnit =
  NonNullable<CatalogProductCaseTemplate["recurrenceIntervalUnit"]>;

export type ProductCaseTemplateDraft = {
  id: string;
  title: string;
  playbookId: string | null;
  recurrenceEnabled: boolean;
  recurrenceIntervalAmount: string;
  recurrenceIntervalUnit: ProductCaseTemplateRecurrenceUnit | null;
  recurrenceLeadTimeAmount: string;
  recurrenceLeadTimeUnit: ProductCaseTemplateRecurrenceUnit | null;
};

export type VariantDraft = {
  id: string;
  title: string;
  sku: string;
  isDefault: boolean;
  taxRateId: string | null;
  manageInventory: boolean;
  allowBackorder: boolean;
  hasInventoryKit: boolean;
  optionValues: Record<string, string>;
  prices: Record<string, VariantPriceValue>;
};

export type ProductFormValues = {
  title: string;
  subtitle: string;
  handle: string;
  sku: string;
  productType: CatalogProductType;
  description: string;
  useMarkdown: boolean;
  taxRateId: string | null;
  mediaDraftId: string;
  mediaItems: ProductMediaItem[];
  defaultMediaId: string | null;
  defaultMediaUrl: string;
  hasVariants: boolean;
  options: ProductOptionInput[];
  variants: VariantDraft[];
  metadata?: Record<string, unknown> | null;
  dimensions?: ProductDimensions;
  weight?: ProductWeight;
  defaultUnit: string | null;
  defaultSalesUnit: string | null;
  defaultSalesUnitQuantity: string;
  uomRoundingScale: string;
  uomRoundingMode: ProductUnitRoundingMode;
  unitPriceEnabled: boolean;
  unitPriceReferenceUnit: string | null;
  unitPriceBaseQuantity: string;
  unitConversions: ProductUnitConversionDraft[];
  customFieldsetCode?: string | null;
  categoryIds: string[];
  channelIds: string[];
  tags: string[];
  optionSchemaId?: string | null;
  serviceLineId: string | null;
  offeringKind: CatalogOfferingKind;
  caseTemplates: ProductCaseTemplateDraft[];
};

const optionalPositiveNumberInput = z.preprocess((value) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim().length === 0) return undefined;
  return value;
}, z.coerce.number().positive().optional());

const optionalBoundedIntegerInput = (min: number, max: number) =>
  z.preprocess((value) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === "string" && value.trim().length === 0)
      return undefined;
    return value;
  }, z.coerce.number().int().min(min).max(max).optional());

export const productFormSchema = z
  .object({
    title: z.string().trim().min(1, "catalog.products.validation.titleRequired"),
    subtitle: z.string().optional(),
    handle: z
      .string()
      .trim()
      .regex(
        /^[a-z0-9\-_]*$/,
        "catalog.products.validation.handleFormat",
      )
      .max(150)
      .optional(),
    sku: z
      .string()
      .trim()
      .regex(
        /^[A-Za-z0-9\-_\.]*$/,
        "catalog.products.validation.skuFormat",
      )
      .max(191)
      .optional(),
    productType: z.string().optional(),
    description: z.string().optional(),
    useMarkdown: z.boolean().optional(),
    taxRateId: z.string().uuid().nullable().optional(),
    hasVariants: z.boolean().optional(),
    mediaDraftId: z.string().optional(),
    mediaItems: z.any().optional(),
    defaultMediaId: z.string().uuid().nullable().optional(),
    defaultMediaUrl: z.string().trim().max(500).nullable().optional(),
    options: z.any().optional(),
    variants: z.any().optional(),
    // Use a permissive schema to avoid zod classic `_zod` runtime crashes on records in edge builds.
    metadata: z
      .custom<Record<string, unknown>>(() => true)
      .nullable()
      .optional(),
    dimensions: z
      .object({
        width: z.coerce.number().min(0).optional(),
        height: z.coerce.number().min(0).optional(),
        depth: z.coerce.number().min(0).optional(),
        unit: z.string().trim().max(25).optional(),
      })
      .nullable()
      .optional(),
    weight: z
      .object({
        value: z.coerce.number().min(0).optional(),
        unit: z.string().trim().max(25).optional(),
      })
      .nullable()
      .optional(),
    defaultUnit: z.string().trim().max(50).nullable().optional(),
    defaultSalesUnit: z.string().trim().max(50).nullable().optional(),
    defaultSalesUnitQuantity: optionalPositiveNumberInput,
    uomRoundingScale: optionalBoundedIntegerInput(0, 6),
    uomRoundingMode: z.enum(["half_up", "down", "up"]).optional(),
    unitPriceEnabled: z.boolean().optional(),
    unitPriceReferenceUnit: z.string().trim().max(50).nullable().optional(),
    unitPriceBaseQuantity: optionalPositiveNumberInput,
    unitConversions: z
      .array(
        z.object({
          id: z.string().nullable().optional(),
          unitCode: z.string().trim().max(50),
          toBaseFactor: z.coerce.number().positive(),
          sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
          isActive: z.boolean().optional(),
        }),
      )
      .optional(),
    customFieldsetCode: z.string().optional().nullable(),
    categoryIds: z.array(z.string().uuid()).optional(),
    channelIds: z.array(z.string().uuid()).optional(),
    tags: z.array(z.string().trim().min(1).max(100)).optional(),
    optionSchemaId: z.string().uuid().nullable().optional(),
    serviceLineId: z.string().uuid().nullable().optional(),
    offeringKind: z.enum(CATALOG_OFFERING_KINDS).optional(),
    caseTemplates: z
      .array(
        z.object({
          id: z.string().uuid(),
          title: z.string(),
          playbookId: z.string().uuid().nullable().optional(),
          recurrenceEnabled: z.boolean().optional(),
          recurrenceIntervalAmount: z.union([z.string(), z.number()]).optional(),
          recurrenceIntervalUnit: z
            .enum(["hours", "days", "weeks", "months"])
            .nullable()
            .optional(),
          recurrenceLeadTimeAmount: z.union([z.string(), z.number()]).optional(),
          recurrenceLeadTimeUnit: z
            .enum(["hours", "days", "weeks", "months"])
            .nullable()
            .optional(),
        }),
      )
      .optional(),
  })
  .passthrough()
  .refine(
    (data) => !data.unitPriceEnabled || (data.unitPriceReferenceUnit != null && data.unitPriceReferenceUnit.length > 0),
    { message: 'catalog.products.validation.referenceUnitRequired', path: ['unitPriceReferenceUnit'] }
  )
  .refine(
    (data) => !data.defaultSalesUnit || (data.defaultUnit != null && data.defaultUnit.length > 0),
    { message: 'catalog.products.validation.baseUnitRequired', path: ['defaultUnit'] }
  );

export const PRODUCT_FORM_STEPS = [
  "general",
  "organize",
  "uom",
  "variants",
] as const;

export const BASE_INITIAL_VALUES: ProductFormValues = {
  title: "",
  subtitle: "",
  handle: "",
  sku: "",
  productType: "simple",
  description: "",
  useMarkdown: false,
  mediaDraftId: "",
  mediaItems: [],
  defaultMediaId: null,
  defaultMediaUrl: "",
  taxRateId: null,
  hasVariants: false,
  options: [],
  variants: [],
  metadata: {},
  dimensions: null,
  weight: null,
  defaultUnit: null,
  defaultSalesUnit: null,
  defaultSalesUnitQuantity: "1",
  uomRoundingScale: "4",
  uomRoundingMode: "half_up",
  unitPriceEnabled: false,
  unitPriceReferenceUnit: null,
  unitPriceBaseQuantity: "",
  unitConversions: [],
  customFieldsetCode: null,
  categoryIds: [],
  channelIds: [],
  tags: [],
  optionSchemaId: null,
  serviceLineId: null,
  offeringKind: "internal_service",
  caseTemplates: [],
};

export const isConfigurableProductType = (type: string): boolean =>
  (CATALOG_CONFIGURABLE_PRODUCT_TYPES as readonly string[]).includes(type);

export const createInitialProductFormValues = (): ProductFormValues => ({
  ...BASE_INITIAL_VALUES,
  mediaDraftId: createLocalId(),
  variants: [createVariantDraft(null, { isDefault: true })],
});

export const createVariantDraft = (
  productTaxRateId: string | null,
  overrides: Partial<VariantDraft> = {},
): VariantDraft => ({
  id: createLocalId(),
  title: "Default variant",
  sku: "",
  isDefault: false,
  taxRateId: productTaxRateId ?? null,
  manageInventory: false,
  allowBackorder: false,
  hasInventoryKit: false,
  optionValues: {},
  prices: {},
  ...overrides,
});

export const createProductUnitConversionDraft = (
  overrides: Partial<ProductUnitConversionDraft> = {},
): ProductUnitConversionDraft => ({
  id: null,
  unitCode: "",
  toBaseFactor: "",
  sortOrder: "",
  isActive: true,
  ...overrides,
});

const CASE_TEMPLATE_RECURRENCE_UNITS = [
  "hours",
  "days",
  "weeks",
  "months",
] as const satisfies readonly ProductCaseTemplateRecurrenceUnit[];

const parseCaseTemplateRecurrenceUnit = (
  raw: unknown,
): ProductCaseTemplateRecurrenceUnit | null => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return (CASE_TEMPLATE_RECURRENCE_UNITS as readonly string[]).includes(trimmed)
    ? (trimmed as ProductCaseTemplateRecurrenceUnit)
    : null;
};

const parseCaseTemplatePositiveInt = (raw: unknown): number | null => {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.trunc(raw);
  }
  if (typeof raw === "string" && raw.trim().length) {
    const numeric = Number(raw.trim());
    if (Number.isFinite(numeric) && numeric > 0) return Math.trunc(numeric);
  }
  return null;
};

export function createProductCaseTemplateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return createLocalId();
}

export const createProductCaseTemplateDraft = (
  overrides: Partial<ProductCaseTemplateDraft> = {},
): ProductCaseTemplateDraft => ({
  id: createProductCaseTemplateId(),
  title: "",
  playbookId: null,
  recurrenceEnabled: false,
  recurrenceIntervalAmount: "",
  recurrenceIntervalUnit: null,
  recurrenceLeadTimeAmount: "",
  recurrenceLeadTimeUnit: null,
  ...overrides,
});

export const normalizeProductCaseTemplates = (
  raw: unknown,
): ProductCaseTemplateDraft[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const id =
        typeof row.id === "string" && row.id.trim().length
          ? row.id.trim()
          : createProductCaseTemplateId();
      const title = typeof row.title === "string" ? row.title : "";
      const playbookId =
        typeof row.playbookId === "string" && row.playbookId.trim().length
          ? row.playbookId.trim()
          : null;
      const leadTimeRaw = row.recurrenceCreateLeadTime;
      const leadTime =
        leadTimeRaw && typeof leadTimeRaw === "object"
          ? (leadTimeRaw as Record<string, unknown>)
          : null;
      const intervalAmount = row.recurrenceIntervalAmount;
      const leadAmount = leadTime?.amount;
      return {
        id,
        title,
        playbookId,
        recurrenceEnabled: row.recurrenceEnabled === true,
        recurrenceIntervalAmount:
          intervalAmount === null || intervalAmount === undefined
            ? ""
            : String(intervalAmount),
        recurrenceIntervalUnit: parseCaseTemplateRecurrenceUnit(
          row.recurrenceIntervalUnit,
        ),
        recurrenceLeadTimeAmount:
          leadAmount === null || leadAmount === undefined
            ? ""
            : String(leadAmount),
        recurrenceLeadTimeUnit: parseCaseTemplateRecurrenceUnit(leadTime?.unit),
      } satisfies ProductCaseTemplateDraft;
    })
    .filter((entry): entry is ProductCaseTemplateDraft => entry !== null);
};

export const sanitizeProductCaseTemplates = (
  drafts: ProductCaseTemplateDraft[] | undefined | null,
): CatalogProductCaseTemplate[] | null => {
  const list = Array.isArray(drafts) ? drafts : [];
  const normalized = list
    .map((draft) => {
      const title = draft.title?.trim() ?? "";
      if (!title.length) return null;
      const template: CatalogProductCaseTemplate = {
        id: draft.id,
        title,
        playbookId: draft.playbookId?.trim().length
          ? draft.playbookId.trim()
          : null,
        recurrenceEnabled: Boolean(draft.recurrenceEnabled),
      };
      if (template.recurrenceEnabled) {
        const intervalAmount = parseCaseTemplatePositiveInt(
          draft.recurrenceIntervalAmount,
        );
        const intervalUnit = draft.recurrenceIntervalUnit;
        if (intervalAmount !== null) {
          template.recurrenceIntervalAmount = intervalAmount;
        }
        if (intervalUnit) {
          template.recurrenceIntervalUnit = intervalUnit;
        }
        const leadAmount = parseCaseTemplatePositiveInt(
          draft.recurrenceLeadTimeAmount,
        );
        const leadUnit = draft.recurrenceLeadTimeUnit;
        if (leadAmount !== null && leadUnit) {
          template.recurrenceCreateLeadTime = {
            amount: leadAmount,
            unit: leadUnit,
          };
        }
      }
      return template;
    })
    .filter((entry): entry is CatalogProductCaseTemplate => entry !== null);
  return normalized.length ? normalized : null;
};

export const buildOptionValuesKey = (
  optionValues?: Record<string, string>,
): string => {
  if (!optionValues) return "";
  return Object.keys(optionValues)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `${key}:${optionValues[key] ?? ""}`)
    .join("|");
};

export const haveSameOptionValues = (
  current: Record<string, string> | undefined,
  next: Record<string, string>,
): boolean => {
  const a = current ?? {};
  const keys = new Set([...Object.keys(a), ...Object.keys(next)]);
  for (const key of keys) {
    if ((a[key] ?? "") !== (next[key] ?? "")) return false;
  }
  return true;
};

const parseNumeric = (input: unknown): number | null => {
  const numeric = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
};

export const normalizeProductDimensions = (raw: unknown): ProductDimensions => {
  const source = parseObjectLike(raw);
  if (!source) return null;
  const width = parseNumeric(source.width);
  const height = parseNumeric(source.height);
  const depth = parseNumeric(source.depth);
  const unit =
    typeof source.unit === "string" && source.unit.trim().length
      ? source.unit.trim()
      : null;
  const clean: Record<string, unknown> = {};
  if (width !== null) clean.width = width;
  if (height !== null) clean.height = height;
  if (depth !== null) clean.depth = depth;
  if (unit) clean.unit = unit;
  return Object.keys(clean).length ? (clean as ProductDimensions) : null;
};

export const normalizeProductWeight = (raw: unknown): ProductWeight => {
  const source = parseObjectLike(raw);
  if (!source) return null;
  const value = parseNumeric(source.value);
  const unit =
    typeof source.unit === "string" && source.unit.trim().length
      ? source.unit.trim()
      : null;
  if (value === null && !unit) return null;
  const clean: Record<string, unknown> = {};
  if (value !== null) clean.value = value;
  if (unit) clean.unit = unit;
  return clean as ProductWeight;
};

export const sanitizeProductDimensions = (
  raw: ProductDimensions,
): ProductDimensions => {
  return normalizeProductDimensions(raw ?? null);
};

export const sanitizeProductWeight = (raw: ProductWeight): ProductWeight => {
  return normalizeProductWeight(raw ?? null);
};

export const updateDimensionValue = (
  current: ProductDimensions,
  field: "width" | "height" | "depth" | "unit",
  raw: string,
): ProductDimensions => {
  const base = normalizeProductDimensions(current) ?? {};
  if (field === "unit") {
    base.unit = raw;
  } else {
    const numeric = parseNumeric(raw);
    if (numeric === null) {
      delete base[field];
    } else {
      base[field] = numeric;
    }
  }
  return sanitizeProductDimensions(base);
};

export const updateWeightValue = (
  current: ProductWeight,
  field: "value" | "unit",
  raw: string,
): ProductWeight => {
  const base = normalizeProductWeight(current) ?? {};
  if (field === "unit") {
    base.unit = raw;
  } else {
    const numeric = parseNumeric(raw);
    if (numeric === null) {
      delete (base as Record<string, unknown>).value;
    } else {
      base.value = numeric;
    }
  }
  return sanitizeProductWeight(base);
};

export const normalizePriceKindSummary = (
  input: PriceKindApiPayload | undefined | null,
): PriceKindSummary | null => {
  if (!input) return null;
  const getString = (value: unknown): string | null => {
    if (typeof value === "string" && value.trim().length) return value.trim();
    if (typeof value === "number" || typeof value === "bigint")
      return String(value);
    return null;
  };
  const id = getString(input.id);
  const code = getString(input.code);
  const title = getString(input.title);
  if (!id || !code || !title) return null;
  const currency =
    getString(input.currencyCode) ?? getString(input.currency_code);
  const displayRaw =
    getString(input.displayMode) ?? getString(input.display_mode);
  const displayMode: PriceKindSummary["displayMode"] =
    displayRaw === "including-tax" ? "including-tax" : "excluding-tax";
  return {
    id,
    code,
    title,
    currencyCode: currency,
    displayMode,
  };
};

export const formatTaxRateLabel = (rate: TaxRateSummary): string => {
  const extras: string[] = [];
  if (typeof rate.rate === "number" && Number.isFinite(rate.rate)) {
    extras.push(`${rate.rate}%`);
  }
  if (rate.code) {
    extras.push(rate.code.toUpperCase());
  }
  if (!extras.length) return rate.name;
  return `${rate.name} • ${extras.join(" · ")}`;
};

export function createLocalId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function buildOptionSchemaDefinition(
  options: ProductOptionInput[] | undefined,
  name: string,
): CatalogProductOptionSchema | null {
  const list = Array.isArray(options) ? options : [];
  if (!list.length) return null;
  const normalizedName =
    name && name.trim().length ? name.trim() : "Product options";
  const schemaOptions = list
    .map((option) => {
      const title = option.title?.trim() || "";
      const code = resolveOptionCode(option);
      const values = Array.isArray(option.values) ? option.values : [];
      return {
        code: code || slugify(createLocalId()),
        label: title || code || "Option",
        inputType: "select" as const,
        choices: values
          .map((value) => {
            const label = value.label?.trim() || "";
            const valueCode = slugify(label || value.id || createLocalId());
            if (!label && !valueCode) return null;
            return {
              code: valueCode || slugify(createLocalId()),
              label: label || valueCode || "Choice",
            };
          })
          .filter((entry): entry is { code: string; label: string } => !!entry),
      };
    })
    .filter((entry) => entry.label.trim().length);
  if (!schemaOptions.length) return null;
  return {
    version: 1,
    name: normalizedName,
    options: schemaOptions,
  };
}

export function convertSchemaToProductOptions(
  schema: CatalogProductOptionSchema | null | undefined,
): ProductOptionInput[] {
  if (!schema || !Array.isArray(schema.options)) return [];
  return schema.options.map((option) => ({
    id: createLocalId(),
    title: option.label ?? option.code ?? "Option",
    values: Array.isArray(option.choices)
      ? option.choices.map((choice) => ({
          id: createLocalId(),
          label: choice.label ?? choice.code ?? "",
        }))
      : [],
  }));
}

function resolveOptionCode(option: ProductOptionInput): string {
  const base = option.title?.trim() || option.id?.trim() || "";
  const slugged = slugify(base);
  if (slugged.length) return slugged;
  if (base.length) return base;
  return createLocalId();
}

export function buildVariantCombinations(
  options: ProductOptionInput[],
): Record<string, string>[] {
  if (!options.length) return [];
  const [first, ...rest] = options;
  if (!first || !Array.isArray(first.values) || !first.values.length) return [];
  const firstKey = resolveOptionCode(first);
  const initial = first.values.map((value) => ({ [firstKey]: value.label }));
  return rest.reduce<Record<string, string>[]>((acc, option) => {
    if (!Array.isArray(option.values) || !option.values.length) return [];
    const optionKey = resolveOptionCode(option);
    const combos: Record<string, string>[] = [];
    acc.forEach((partial) => {
      option.values.forEach((value) => {
        combos.push({ ...partial, [optionKey]: value.label });
      });
    });
    return combos;
  }, initial);
}
