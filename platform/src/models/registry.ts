import type { ResourceType } from "../permissions";
import type { Role } from "../types";

export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "badge"
  | "risk_score"
  | "email";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  sortable?: boolean;
  filterable?: boolean;
  detailOnly?: boolean;
  /** Optional field-level visibility restriction by role. Omit to allow all roles with model read access. */
  allowedRoles?: readonly Role[];
}

export interface ModelDefinition {
  /** Unique registry key (e.g. "kyc_case", "refund_request"). */
  name: string;
  label: string;
  pluralLabel: string;
  /** Prisma delegate name (e.g. "kycCase") and Prisma model name for audit lookups (e.g. "KycCase"). */
  prismaModel: string;
  auditEntityType: string;
  /** RBAC resource type passed to can(user, action, resource). */
  resource: ResourceType;
  idField?: string;
  defaultSort?: {
    field: string;
    direction: "asc" | "desc";
  };
  searchableFields?: readonly string[];
  editableFields?: readonly string[];
  fields: readonly FieldDef[];
  listColumns: readonly string[];
}

export class ModelError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ModelError";
    this.statusCode = statusCode;
  }
}

const modelRegistry = new Map<string, ModelDefinition>();

export function defineModel(definition: ModelDefinition): ModelDefinition {
  const fieldKeys = new Set(definition.fields.map((f) => f.key));

  for (const col of definition.listColumns) {
    if (!fieldKeys.has(col)) {
      throw new ModelError(
        `Model "${definition.name}" listColumn "${col}" is not declared in fields`,
        500,
      );
    }
  }

  for (const editable of definition.editableFields ?? []) {
    if (!fieldKeys.has(editable)) {
      throw new ModelError(
        `Model "${definition.name}" editableField "${editable}" is not declared in fields`,
        500,
      );
    }
  }

  for (const searchable of definition.searchableFields ?? []) {
    if (!fieldKeys.has(searchable)) {
      throw new ModelError(
        `Model "${definition.name}" searchableField "${searchable}" is not declared in fields`,
        500,
      );
    }
  }

  if (definition.defaultSort && !fieldKeys.has(definition.defaultSort.field)) {
    throw new ModelError(
      `Model "${definition.name}" defaultSort field "${definition.defaultSort.field}" is not declared in fields`,
      500,
    );
  }

  const frozen: ModelDefinition = {
    ...definition,
    idField: definition.idField ?? "id",
  };
  modelRegistry.set(frozen.name, frozen);
  return frozen;
}

export function getModel(name: string): ModelDefinition | undefined {
  return modelRegistry.get(name);
}

export function listModels(): ModelDefinition[] {
  return Array.from(modelRegistry.values());
}

export function clearModelRegistry(): void {
  modelRegistry.clear();
}

export function getVisibleFields(
  model: ModelDefinition,
  role: Role,
): FieldDef[] {
  return model.fields.filter(
    (field) => !field.allowedRoles || field.allowedRoles.includes(role),
  );
}

export function pickVisibleRecord<T extends Record<string, unknown>>(
  record: T,
  model: ModelDefinition,
  role: Role,
): Record<string, unknown> {
  const idField = model.idField ?? "id";
  const visibleKeys = new Set(getVisibleFields(model, role).map((f) => f.key));
  visibleKeys.add(idField);

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (visibleKeys.has(k)) {
      out[k] = v;
    }
  }
  return out;
}
