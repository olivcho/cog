import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "../auth/password";
import { HIGH_RISK_THRESHOLD, type Role } from "../types";

export interface DemoAccountInfo {
  email: string;
  name: string;
  role: Role;
  password: string;
  description: string;
}

export const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD ?? "demo1234";

export const DEMO_ACCOUNTS: readonly DemoAccountInfo[] = [
  {
    email: "analyst@fintech.demo",
    name: "Alex Rivera",
    role: "analyst",
    password: DEMO_PASSWORD,
    description:
      "Claims cases, approves low-risk (<70), submits 1st sign-off or escalates high-risk.",
  },
  {
    email: "senior@fintech.demo",
    name: "Samira Patel",
    role: "senior_reviewer",
    password: DEMO_PASSWORD,
    description:
      "All analyst capabilities plus 2nd-approver sign-off on high-risk (>=70) cases.",
  },
  {
    email: "admin@fintech.demo",
    name: "Casey Morgan",
    role: "compliance_admin",
    password: DEMO_PASSWORD,
    description:
      "Full permissions: reassign any case, approve high-risk cases, view org-wide audit logs.",
  },
  {
    email: "auditor@fintech.demo",
    name: "Avery Chen",
    role: "auditor",
    password: DEMO_PASSWORD,
    description:
      "Read-only access across all KYC cases and append-only audit logs. Mutations return 403.",
  },
];

interface SeedDoc {
  docType: string;
  fileName: string;
  status: string;
  extracted: Record<string, string>;
}

interface SeedMatch {
  listName: string;
  matchedName: string;
  matchScore: number;
  category: string;
  details: string;
  disposition: string;
}

interface SeedCase {
  caseNumber: string;
  customerName: string;
  customerEmail: string;
  country: string;
  accountType: "individual" | "business";
  riskScore: number;
  status:
    | "open"
    | "in_review"
    | "pending_second_approval"
    | "approved"
    | "rejected"
    | "escalated";
  slaOffsetHours: number;
  assigneeEmail?: string;
  summary: string;
  documents: SeedDoc[];
  matches: SeedMatch[];
  approvalSteps?: {
    actorEmail: string;
    decision: "approved" | "rejected" | "escalated";
    reason: string;
  }[];
}

const SEED_CASES: SeedCase[] = [
  {
    caseNumber: "KYC-2026-1001",
    customerName: "Meridian Freight Holdings LLC",
    customerEmail: "treasury@meridianfreight.example",
    country: "CY",
    accountType: "business",
    riskScore: 88,
    status: "pending_second_approval",
    slaOffsetHours: -2,
    assigneeEmail: "analyst@fintech.demo",
    summary:
      "High-volume maritime logistics onboarding ($4.2M projected monthly wire volume). First sign-off completed by Alex Rivera; awaiting senior reviewer second sign-off.",
    documents: [
      {
        docType: "corporate_filing",
        fileName: "meridian-cyprus-incorporation-2024.pdf",
        status: "flagged",
        extracted: {
          registrationNumber: "HE-419822",
          jurisdiction: "Cyprus",
          beneficialOwner: "Nikos Petrou (62%)",
          incorporationDate: "2024-03-14",
        },
      },
      {
        docType: "bank_statement",
        fileName: "meridian-q3-operating-statement.pdf",
        status: "verified",
        extracted: {
          institution: "Bank of Cyprus",
          endingBalance: "$1,840,210.00",
          statementPeriod: "2026-07-01 to 2026-09-30",
        },
      },
      {
        docType: "passport",
        fileName: "nikos-petrou-passport.pdf",
        status: "verified",
        extracted: {
          fullName: "Nikos Petrou",
          nationality: "CY",
          documentNumber: "CY-8829104",
          expiresOn: "2031-05-19",
        },
      },
    ],
    matches: [
      {
        listName: "PEP_GLOBAL",
        matchedName: "Nikos Petrou (Former Deputy Port Commissioner)",
        matchScore: 84,
        category: "pep",
        details:
          "Beneficial owner held public port authority appointment 2016-2020. Source of wealth documentation verified.",
        disposition: "pending",
      },
      {
        listName: "EU_SANCTIONS",
        matchedName: "Meridian Shipping Co. (Dissolved 2019)",
        matchScore: 63,
        category: "sanctions",
        details:
          "Partial name overlap only; different registration number and jurisdiction.",
        disposition: "false_positive",
      },
    ],
    approvalSteps: [
      {
        actorEmail: "analyst@fintech.demo",
        decision: "approved",
        reason:
          "Verified beneficial owner source of wealth and confirmed EU sanctions hit is a distinct dissolved entity. Routing for senior second sign-off.",
      },
    ],
  },
  {
    caseNumber: "KYC-2026-1002",
    customerName: "Viktor Solovyov",
    customerEmail: "v.solovyov@eastbridge.example",
    country: "AE",
    accountType: "individual",
    riskScore: 94,
    status: "in_review",
    slaOffsetHours: 1.5,
    assigneeEmail: "analyst@fintech.demo",
    summary:
      "Private wealth account application with strong OFAC SDN and PEP list overlaps. High priority SLA.",
    documents: [
      {
        docType: "passport",
        fileName: "solovyov-passport-scan.pdf",
        status: "flagged",
        extracted: {
          fullName: "Viktor A. Solovyov",
          nationality: "RU",
          residency: "UAE",
          expiresOn: "2029-11-02",
        },
      },
      {
        docType: "proof_of_address",
        fileName: "dubai-dewa-utility-oct.pdf",
        status: "pending",
        extracted: {
          address: "Marina Gate Tower 2, Dubai, AE",
          issueDate: "2026-10-12",
        },
      },
    ],
    matches: [
      {
        listName: "OFAC_SDN",
        matchedName: "Viktor Aleksandrovich Solovyov",
        matchScore: 92,
        category: "sanctions",
        details:
          "Strong name + DOB match against OFAC SDN Executive Order 14024 designation.",
        disposition: "pending",
      },
      {
        listName: "PEP_GLOBAL",
        matchedName: "Viktor Solovyov — State Energy Board",
        matchScore: 86,
        category: "pep",
        details: "Listed as board advisor to state-owned energy subsidiary.",
        disposition: "pending",
      },
    ],
  },
  {
    caseNumber: "KYC-2026-1003",
    customerName: "Helios Cross-Border Payments Ltd",
    customerEmail: "compliance@heliospay.example",
    country: "GB",
    accountType: "business",
    riskScore: 79,
    status: "open",
    slaOffsetHours: 3,
    summary:
      "UK FCA-registered payment intermediary requesting USD settlement rails. Unassigned high-risk case.",
    documents: [
      {
        docType: "corporate_filing",
        fileName: "helios-companies-house-extract.pdf",
        status: "verified",
        extracted: {
          companyNumber: "11890421",
          jurisdiction: "United Kingdom",
          fcaReference: "FRN-901244",
        },
      },
      {
        docType: "bank_statement",
        fileName: "helios-barclays-safeguarding.pdf",
        status: "verified",
        extracted: {
          institution: "Barclays Corporate UK",
          endingBalance: "£3,120,400.00",
        },
      },
    ],
    matches: [
      {
        listName: "PEP_GLOBAL",
        matchedName: "Lord Alistair Finch (Non-Executive Director)",
        matchScore: 74,
        category: "pep",
        details: "Non-executive director holds UK parliamentary peerage.",
        disposition: "pending",
      },
    ],
  },
  {
    caseNumber: "KYC-2026-1004",
    customerName: "Elena Rostova",
    customerEmail: "elena.rostova@nordiccap.example",
    country: "CH",
    accountType: "individual",
    riskScore: 72,
    status: "open",
    slaOffsetHours: -0.75,
    summary:
      "Cross-border brokerage onboarding. SLA breached; requires two-person sign-off above risk threshold 70.",
    documents: [
      {
        docType: "passport",
        fileName: "rostova-swiss-id.pdf",
        status: "verified",
        extracted: {
          fullName: "Elena Rostova",
          nationality: "CH",
          documentNumber: "CH-5521098",
        },
      },
      {
        docType: "proof_of_address",
        fileName: "zurich-cantonal-tax-notice.pdf",
        status: "verified",
        extracted: {
          address: "Bahnhofstrasse 44, 8001 Zurich",
          issueDate: "2026-09-01",
        },
      },
    ],
    matches: [
      {
        listName: "PEP_GLOBAL",
        matchedName: "Elena Rostova (Municipal Treasury Advisor)",
        matchScore: 68,
        category: "pep",
        details: "Regional public advisory role; low corruption index jurisdiction.",
        disposition: "pending",
      },
    ],
  },
  {
    caseNumber: "KYC-2026-1005",
    customerName: "Bayside Coffee Roasters LLC",
    customerEmail: "finance@baysidecoffee.example",
    country: "US",
    accountType: "business",
    riskScore: 24,
    status: "open",
    slaOffsetHours: 18,
    summary:
      "Domestic US specialty coffee wholesaler applying for corporate cards. Clean sanctions screen; eligible for single-approver sign-off.",
    documents: [
      {
        docType: "corporate_filing",
        fileName: "bayside-delaware-good-standing.pdf",
        status: "verified",
        extracted: {
          ein: "84-3920114",
          state: "Delaware",
          status: "Active / Good Standing",
        },
      },
      {
        docType: "bank_statement",
        fileName: "bayside-svb-checking-oct.pdf",
        status: "verified",
        extracted: {
          institution: "First Citizens Bank",
          endingBalance: "$285,420.12",
        },
      },
    ],
    matches: [],
  },
  {
    caseNumber: "KYC-2026-1006",
    customerName: "Marcus Vance",
    customerEmail: "marcus.vance@gmail.example",
    country: "US",
    accountType: "individual",
    riskScore: 31,
    status: "in_review",
    slaOffsetHours: 10,
    assigneeEmail: "analyst@fintech.demo",
    summary:
      "Standard US retail high-yield account. Automated IDV passed; awaiting analyst final check.",
    documents: [
      {
        docType: "drivers_license",
        fileName: "vance-ca-dl-front-back.pdf",
        status: "verified",
        extracted: {
          fullName: "Marcus D. Vance",
          state: "CA",
          expiresOn: "2030-08-15",
        },
      },
      {
        docType: "proof_of_address",
        fileName: "vance-pge-bill.pdf",
        status: "verified",
        extracted: {
          address: "742 Valencia St, San Francisco, CA 94110",
          issueDate: "2026-10-20",
        },
      },
    ],
    matches: [],
  },
  {
    caseNumber: "KYC-2026-1007",
    customerName: "Kestrel Maritime Services SA",
    customerEmail: "ops@kestrelmaritime.example",
    country: "PA",
    accountType: "business",
    riskScore: 83,
    status: "escalated",
    slaOffsetHours: -5,
    assigneeEmail: "senior@fintech.demo",
    summary:
      "Panama-registered vessel chartering entity escalated to compliance legal for beneficial ownership opacity.",
    documents: [
      {
        docType: "corporate_filing",
        fileName: "kestrel-panama-bearer-registry.pdf",
        status: "flagged",
        extracted: {
          jurisdiction: "Panama",
          shareStructure: "Nominee directors listed; UBO chain incomplete",
        },
      },
    ],
    matches: [
      {
        listName: "UN_SANCTIONS",
        matchedName: "MV Kestrel Star (Vessel Watchlist)",
        matchScore: 81,
        category: "sanctions",
        details: "AIS dark-voyage alert linked to vessel previously managed by affiliate.",
        disposition: "pending",
      },
    ],
    approvalSteps: [
      {
        actorEmail: "analyst@fintech.demo",
        decision: "escalated",
        reason:
          "Incomplete UBO disclosure and vessel watchlist match; escalated to senior compliance team.",
      },
    ],
  },
  {
    caseNumber: "KYC-2026-1008",
    customerName: "Priya Nair",
    customerEmail: "priya.nair@cloudscale.example",
    country: "US",
    accountType: "individual",
    riskScore: 18,
    status: "approved",
    slaOffsetHours: 24,
    assigneeEmail: "analyst@fintech.demo",
    summary: "Low-risk domestic individual onboarding approved in 1 step.",
    documents: [
      {
        docType: "passport",
        fileName: "nair-us-passport.pdf",
        status: "verified",
        extracted: {
          fullName: "Priya Nair",
          nationality: "US",
          expiresOn: "2033-01-11",
        },
      },
    ],
    matches: [],
    approvalSteps: [
      {
        actorEmail: "analyst@fintech.demo",
        decision: "approved",
        reason: "US passport verified and zero watchlist matches.",
      },
    ],
  },
  {
    caseNumber: "KYC-2026-1009",
    customerName: "Orion Crypto Liquidity Desk",
    customerEmail: "desk@orionliquidity.example",
    country: "VG",
    accountType: "business",
    riskScore: 91,
    status: "rejected",
    slaOffsetHours: 12,
    assigneeEmail: "senior@fintech.demo",
    summary:
      "Offshore OTC desk rejected following confirmed OFAC wallet cluster exposure.",
    documents: [
      {
        docType: "corporate_filing",
        fileName: "orion-bvi-cert.pdf",
        status: "flagged",
        extracted: {
          jurisdiction: "British Virgin Islands",
          registrationNumber: "BVI-2099121",
        },
      },
    ],
    matches: [
      {
        listName: "OFAC_SDN",
        matchedName: "Orion OTC / Guaranteed Mixer Cluster",
        matchScore: 96,
        category: "sanctions",
        details: "Direct on-chain exposure to OFAC-designated mixing service.",
        disposition: "confirmed",
      },
    ],
    approvalSteps: [
      {
        actorEmail: "senior@fintech.demo",
        decision: "rejected",
        reason:
          "Confirmed OFAC SDN exposure on counterparty wallet cluster; outside risk appetite.",
      },
    ],
  },
  {
    caseNumber: "KYC-2026-1010",
    customerName: "Nadia Al-Mansoor",
    customerEmail: "nadia@gulfventures.example",
    country: "GB",
    accountType: "individual",
    riskScore: 56,
    status: "in_review",
    slaOffsetHours: 5,
    assigneeEmail: "analyst@fintech.demo",
    summary:
      "Medium-risk angel investor account with partial PEP name similarity under review.",
    documents: [
      {
        docType: "passport",
        fileName: "al-mansoor-uk-passport.pdf",
        status: "verified",
        extracted: {
          fullName: "Nadia Al-Mansoor",
          nationality: "GB",
          expiresOn: "2032-04-08",
        },
      },
      {
        docType: "bank_statement",
        fileName: "al-mansoor-hsbc-uk.pdf",
        status: "verified",
        extracted: {
          institution: "HSBC UK",
          endingBalance: "£412,900.00",
        },
      },
    ],
    matches: [
      {
        listName: "PEP_GLOBAL",
        matchedName: "Nadia Mansoor (Regional Cultural Attaché)",
        matchScore: 58,
        category: "pep",
        details: "Different year of birth (1968 vs 1989); likely false positive.",
        disposition: "pending",
      },
    ],
  },
  {
    caseNumber: "KYC-2026-1011",
    customerName: "Timberline Hardware Co",
    customerEmail: "ap@timberlinehw.example",
    country: "CA",
    accountType: "business",
    riskScore: 42,
    status: "open",
    slaOffsetHours: 14,
    summary:
      "Canadian industrial distributor seeking multi-currency treasury account.",
    documents: [
      {
        docType: "corporate_filing",
        fileName: "timberline-ontario-articles.pdf",
        status: "verified",
        extracted: {
          jurisdiction: "Ontario, Canada",
          businessNumber: "81234-5678-RC0001",
        },
      },
    ],
    matches: [],
  },
  {
    caseNumber: "KYC-2026-1012",
    customerName: "Jean-Luc Moreau",
    customerEmail: "jl.moreau@atelier-paris.example",
    country: "FR",
    accountType: "individual",
    riskScore: 76,
    status: "approved",
    slaOffsetHours: 36,
    assigneeEmail: "senior@fintech.demo",
    summary:
      "High-risk art dealer account cleared via full two-person sign-off (Alex Rivera + Samira Patel).",
    documents: [
      {
        docType: "passport",
        fileName: "moreau-fr-passport.pdf",
        status: "verified",
        extracted: {
          fullName: "Jean-Luc Moreau",
          nationality: "FR",
          expiresOn: "2031-09-22",
        },
      },
      {
        docType: "bank_statement",
        fileName: "moreau-bnp-paribas.pdf",
        status: "verified",
        extracted: {
          institution: "BNP Paribas",
          endingBalance: "€920,000.00",
        },
      },
    ],
    matches: [
      {
        listName: "PEP_GLOBAL",
        matchedName: "Jean-Luc Moreau (City Council Member, Lyon)",
        matchScore: 62,
        category: "pep",
        details: "Confirmed distinct individual via national ID & DOB.",
        disposition: "false_positive",
      },
    ],
    approvalSteps: [
      {
        actorEmail: "analyst@fintech.demo",
        decision: "approved",
        reason: "Cleared PEP false positive via DOB mismatch; verified BNP Paribas source of funds.",
      },
      {
        actorEmail: "senior@fintech.demo",
        decision: "approved",
        reason: "Second sign-off completed; high-value art dealer monitoring rules enabled.",
      },
    ],
  },
];

export async function seedDemoData(
  prisma: PrismaClient,
  options: { reset?: boolean } = {},
): Promise<{ users: number; cases: number }> {
  if (options.reset) {
    await prisma.approvalStep.deleteMany();
    await prisma.approvalRequest.deleteMany();
    await prisma.sanctionsMatch.deleteMany();
    await prisma.kycDocument.deleteMany();
    await prisma.kycCase.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  }

  const userByEmail = new Map<string, { id: string; email: string }>();

  for (const account of DEMO_ACCOUNTS) {
    const existing = await prisma.user.findUnique({
      where: { email: account.email },
    });
    if (existing) {
      userByEmail.set(account.email, { id: existing.id, email: existing.email });
    } else {
      const created = await prisma.user.create({
        data: {
          email: account.email,
          name: account.name,
          role: account.role,
          passwordHash: await hashPassword(account.password),
        },
      });
      userByEmail.set(account.email, { id: created.id, email: created.email });
    }
  }

  let createdCases = 0;
  const now = Date.now();

  for (const item of SEED_CASES) {
    const existingCase = await prisma.kycCase.findUnique({
      where: { caseNumber: item.caseNumber },
    });
    if (existingCase) continue;

    const assignee = item.assigneeEmail
      ? userByEmail.get(item.assigneeEmail)
      : undefined;

    const kycCase = await prisma.kycCase.create({
      data: {
        caseNumber: item.caseNumber,
        customerName: item.customerName,
        customerEmail: item.customerEmail,
        country: item.country,
        accountType: item.accountType,
        riskScore: item.riskScore,
        status: item.status,
        slaDueAt: new Date(now + item.slaOffsetHours * 3600_000),
        assigneeId: assignee?.id ?? null,
        summary: item.summary,
        documents: {
          create: item.documents.map((doc) => ({
            docType: doc.docType,
            fileName: doc.fileName,
            status: doc.status,
            extractedJson: JSON.stringify(doc.extracted),
          })),
        },
        sanctionsMatches: {
          create: item.matches.map((m) => ({
            listName: m.listName,
            matchedName: m.matchedName,
            matchScore: m.matchScore,
            category: m.category,
            details: m.details,
            disposition: m.disposition,
          })),
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: null,
        actorEmail: "onboarding-pipeline@fintech.demo",
        action: "create",
        entityType: "KycCase",
        entityId: kycCase.id,
        afterJson: JSON.stringify({
          caseNumber: kycCase.caseNumber,
          riskScore: kycCase.riskScore,
          status: "open",
        }),
        reason: "Case ingested from automated onboarding screening",
      },
    });

    const firstStep = item.approvalSteps?.[0];
    if (firstStep && item.approvalSteps) {
      const creator = userByEmail.get(firstStep.actorEmail)!;
      const approvalStatus =
        item.status === "pending_second_approval" ||
        item.status === "approved" ||
        item.status === "rejected" ||
        item.status === "escalated"
          ? item.status
          : "pending";

      const approvalReq = await prisma.approvalRequest.create({
        data: {
          entityType: "KycCase",
          entityId: kycCase.id,
          status: approvalStatus,
          requiredApprovals: item.riskScore >= HIGH_RISK_THRESHOLD ? 2 : 1,
          riskScore: item.riskScore,
          createdById: creator.id,
        },
      });

      for (const [i, stepDef] of item.approvalSteps.entries()) {
        const stepActor = userByEmail.get(stepDef.actorEmail)!;
        await prisma.approvalStep.create({
          data: {
            approvalRequestId: approvalReq.id,
            stepNumber: i + 1,
            actorId: stepActor.id,
            decision: stepDef.decision,
            reason: stepDef.reason,
          },
        });

        await prisma.auditLog.create({
          data: {
            actorId: stepActor.id,
            actorEmail: stepActor.email,
            action:
              stepDef.decision === "approved"
                ? "approve"
                : stepDef.decision === "rejected"
                  ? "reject"
                  : "escalate",
            entityType: "KycCase",
            entityId: kycCase.id,
            afterJson: JSON.stringify({
              status: approvalStatus,
              stepNumber: i + 1,
            }),
            reason: stepDef.reason,
          },
        });
      }
    }

    createdCases++;
  }

  return { users: userByEmail.size, cases: createdCases };
}
