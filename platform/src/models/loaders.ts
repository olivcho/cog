import type { AuditLog, PrismaClient } from "@prisma/client";
import {
  getEntityAuditTrail,
  withAuditContext,
  type AuditedPrismaClient,
} from "../audit";
import { assertCan, can } from "../permissions";
import type { SessionUser } from "../types";
import {
  getVisibleFields,
  ModelError,
  pickVisibleRecord,
  type FieldDef,
  type ModelDefinition,
} from "./registry";

interface PrismaModelDelegate {
  findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
  findUnique: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  count: (args: Record<string, unknown>) => Promise<number>;
  update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  delete: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

function getDelegate(
  client: PrismaClient | AuditedPrismaClient,
  model: ModelDefinition,
): PrismaModelDelegate {
  const delegate = (client as unknown as Record<string, unknown>)[
    model.prismaModel
  ] as PrismaModelDelegate | undefined;

  if (!delegate || typeof delegate.findMany !== "function") {
    throw new ModelError(
      `Prisma delegate "${model.prismaModel}" not found for model "${model.name}"`,
      500,
    );
  }
  return delegate;
}

export interface ListModelOptions {
  filters?: Record<string, string | number | boolean>;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface ListModelResult {
  items: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
  visibleFields: FieldDef[];
  columns: FieldDef[];
}

export async function listModelRecords(
  client: PrismaClient | AuditedPrismaClient,
  actor: SessionUser | null | undefined,
  model: ModelDefinition,
  options: ListModelOptions = {},
): Promise<ListModelResult> {
  assertCan(actor, "read", model.resource);
  const user = actor!;

  const visibleFields = getVisibleFields(model, user.role);
  const visibleByKey = new Map(visibleFields.map((f) => [f.key, f]));

  const where: Record<string, unknown> = {};

  if (options.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      const field = visibleByKey.get(key);
      if (!field || !field.filterable) {
        throw new ModelError(
          `Field "${key}" is not filterable on model "${model.name}"`,
          400,
        );
      }
      where[key] = value;
    }
  }

  const trimmedSearch = options.search?.trim();
  if (trimmedSearch && model.searchableFields?.length) {
    const allowedSearchFields = model.searchableFields.filter((k) =>
      visibleByKey.has(k),
    );
    if (allowedSearchFields.length > 0) {
      where.OR = allowedSearchFields.map((fieldKey) => ({
        [fieldKey]: { contains: trimmedSearch },
      }));
    }
  }

  let orderBy: Record<string, "asc" | "desc"> | undefined;
  if (options.sortBy) {
    const sortField = visibleByKey.get(options.sortBy);
    if (!sortField || !sortField.sortable) {
      throw new ModelError(
        `Field "${options.sortBy}" is not sortable on model "${model.name}"`,
        400,
      );
    }
    orderBy = { [options.sortBy]: options.sortDir === "asc" ? "asc" : "desc" };
  } else if (model.defaultSort && visibleByKey.has(model.defaultSort.field)) {
    orderBy = { [model.defaultSort.field]: model.defaultSort.direction };
  }

  const rawLimit =
    typeof options.limit === "number" && Number.isFinite(options.limit)
      ? options.limit
      : 50;
  const rawOffset =
    typeof options.offset === "number" && Number.isFinite(options.offset)
      ? options.offset
      : 0;
  const limit = Math.min(Math.max(Math.trunc(rawLimit), 1), 100);
  const offset = Math.max(Math.trunc(rawOffset), 0);

  const delegate = getDelegate(client, model);
  const [rawItems, total] = await Promise.all([
    delegate.findMany({
      where,
      ...(orderBy ? { orderBy } : {}),
      take: limit,
      skip: offset,
    }),
    delegate.count({ where }),
  ]);

  const items = rawItems.map((row) => pickVisibleRecord(row, model, user.role));
  const columns = model.listColumns
    .map((key) => visibleByKey.get(key))
    .filter((f): f is FieldDef => Boolean(f));

  return {
    items,
    total,
    limit,
    offset,
    visibleFields,
    columns,
  };
}

export interface GetModelRecordOptions {
  includeAuditTrail?: boolean;
  /** Base PrismaClient used to query AuditLog when includeAuditTrail is true. */
  auditClient?: PrismaClient;
}

export interface GetModelRecordResult {
  record: Record<string, unknown>;
  visibleFields: FieldDef[];
  auditTrail?: AuditLog[];
}

export async function getModelRecord(
  client: PrismaClient | AuditedPrismaClient,
  actor: SessionUser | null | undefined,
  model: ModelDefinition,
  id: string,
  options: GetModelRecordOptions = {},
): Promise<GetModelRecordResult> {
  assertCan(actor, "read", { type: model.resource, id });
  const user = actor!;

  const idField = model.idField ?? "id";
  const delegate = getDelegate(client, model);
  const raw = await delegate.findUnique({ where: { [idField]: id } });

  if (!raw) {
    throw new ModelError(`${model.label} "${id}" not found`, 404);
  }

  const visibleFields = getVisibleFields(model, user.role);
  const record = pickVisibleRecord(raw, model, user.role);

  let auditTrail: AuditLog[] | undefined;
  if (options.includeAuditTrail && can(user, "read", "audit_log")) {
    const auditReader =
      options.auditClient ?? (client as unknown as PrismaClient);
    auditTrail = await getEntityAuditTrail(
      auditReader,
      model.auditEntityType,
      id,
    );
  }

  return {
    record,
    visibleFields,
    ...(auditTrail !== undefined ? { auditTrail } : {}),
  };
}

export async function updateModelRecord(
  auditedClient: AuditedPrismaClient,
  actor: SessionUser | null | undefined,
  model: ModelDefinition,
  id: string,
  patch: Record<string, unknown>,
  reason?: string,
): Promise<Record<string, unknown>> {
  assertCan(actor, "update", { type: model.resource, id });
  const user = actor!;

  const editableSet = new Set(model.editableFields ?? []);
  const keys = Object.keys(patch);
  if (keys.length === 0) {
    throw new ModelError("Update payload cannot be empty", 400);
  }

  const visibleSet = new Set(
    getVisibleFields(model, user.role).map((f) => f.key),
  );

  for (const key of keys) {
    if (!editableSet.has(key) || !visibleSet.has(key)) {
      throw new ModelError(
        `Field "${key}" is not editable on model "${model.name}"`,
        400,
      );
    }
  }

  const idField = model.idField ?? "id";
  const delegate = getDelegate(auditedClient, model);

  const existing = await delegate.findUnique({ where: { [idField]: id } });
  if (!existing) {
    throw new ModelError(`${model.label} "${id}" not found`, 404);
  }

  const updated = await withAuditContext(
    {
      actor: user,
      reason: reason ?? `Updated ${model.label}`,
    },
    () =>
      delegate.update({
        where: { [idField]: id },
        data: patch,
      }),
  );

  return pickVisibleRecord(updated, model, user.role);
}

export async function deleteModelRecord(
  auditedClient: AuditedPrismaClient,
  actor: SessionUser | null | undefined,
  model: ModelDefinition,
  id: string,
  reason?: string,
): Promise<void> {
  assertCan(actor, "delete", { type: model.resource, id });
  const user = actor!;

  const idField = model.idField ?? "id";
  const delegate = getDelegate(auditedClient, model);

  const existing = await delegate.findUnique({ where: { [idField]: id } });
  if (!existing) {
    throw new ModelError(`${model.label} "${id}" not found`, 404);
  }

  await withAuditContext(
    {
      actor: user,
      reason: reason ?? `Deleted ${model.label}`,
    },
    () => delegate.delete({ where: { [idField]: id } }),
  );
}
