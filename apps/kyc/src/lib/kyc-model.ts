import { defineModel, getModel } from "@internal/platform/models/registry";

export const kycCaseModel =
  getModel("kyc_case") ??
  defineModel({
    name: "kyc_case",
    label: "KYC Case",
    pluralLabel: "KYC Cases",
    prismaModel: "kycCase",
    auditEntityType: "KycCase",
    resource: "kyc_case",
    defaultSort: { field: "slaDueAt", direction: "asc" },
    searchableFields: ["caseNumber", "customerName", "customerEmail", "country"],
    editableFields: ["summary", "status"],
    fields: [
      { key: "caseNumber", label: "Case #", type: "string", sortable: true },
      { key: "customerName", label: "Customer", type: "string", sortable: true },
      { key: "customerEmail", label: "Email", type: "email", detailOnly: true },
      { key: "country", label: "Country", type: "string", filterable: true },
      {
        key: "accountType",
        label: "Account",
        type: "badge",
        filterable: true,
      },
      {
        key: "riskScore",
        label: "Risk Score",
        type: "risk_score",
        sortable: true,
      },
      { key: "status", label: "Status", type: "badge", filterable: true },
      { key: "slaDueAt", label: "SLA", type: "date", sortable: true },
      { key: "assigneeId", label: "Assignee ID", type: "string", detailOnly: true },
      { key: "assigneeName", label: "Assignee", type: "string" },
      { key: "summary", label: "Summary", type: "string", detailOnly: true },
    ],
    listColumns: [
      "caseNumber",
      "customerName",
      "country",
      "riskScore",
      "status",
      "slaDueAt",
      "assigneeName",
    ],
  });
