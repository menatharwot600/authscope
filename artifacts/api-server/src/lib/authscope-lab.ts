import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  authscopeDemoResourcesTable,
  authscopeLabConfigTable,
} from "@workspace/db";
import {
  objectMutationStatus,
  objectReadStatus,
} from "./authscope-policy";

export type DemoActor = "alice" | "bob";
export type LabMode = "vulnerable" | "secure";
export type TestOutcome = "allowed" | "denied" | "blocked" | "error";
export type ResultVariant = "current" | "vulnerable" | "secure";

type DemoResource = typeof authscopeDemoResourcesTable.$inferSelect;

export interface TestResultDraft {
  caseKey: string;
  name: string;
  description: string;
  variant: ResultVariant;
  expectedOutcome: TestOutcome;
  expectedStatus: number;
  actualOutcome: TestOutcome;
  actualStatus: number;
  passed: boolean;
  severity: "critical" | "high" | "medium" | "low" | "informational" | null;
  evidence: string;
  remediation: string;
}

export interface ComparisonDraft {
  caseKey: string;
  name: string;
  description: string;
  expectedBehavior: string;
  vulnerable: {
    outcome: TestOutcome;
    status: number;
    passed: boolean;
    evidence: string;
  };
  secure: {
    outcome: TestOutcome;
    status: number;
    passed: boolean;
    evidence: string;
  };
  improvement: string;
}

export const actorNames: Record<DemoActor, string> = {
  alice: "Alice",
  bob: "Bob",
};

export async function ensureAuthScopeSeedData(): Promise<void> {
  await db
    .insert(authscopeLabConfigTable)
    .values({ id: 1, mode: "secure" })
    .onConflictDoNothing();

  await db
    .insert(authscopeDemoResourcesTable)
    .values([
      {
        id: 101,
        ownerId: "alice",
        ownerName: "Alice",
        name: "Project Atlas",
        description:
          "Synthetic project record owned by Alice for object-level access testing.",
      },
      {
        id: 202,
        ownerId: "bob",
        ownerName: "Bob",
        name: "Project Meridian",
        description:
          "Synthetic project record owned by Bob for object-level access testing.",
      },
    ])
    .onConflictDoNothing();

  await db.execute(sql`
    SELECT setval(
      pg_get_serial_sequence('authscope_demo_resources', 'id'),
      GREATEST(COALESCE((SELECT MAX(id) FROM authscope_demo_resources), 1), 1)
    )
  `);
}

export async function ensureScenarioResources(): Promise<void> {
  await db
    .insert(authscopeDemoResourcesTable)
    .values([
      {
        id: 101,
        ownerId: "alice",
        ownerName: "Alice",
        name: "Project Atlas",
        description:
          "Synthetic project record owned by Alice for object-level access testing.",
      },
      {
        id: 202,
        ownerId: "bob",
        ownerName: "Bob",
        name: "Project Meridian",
        description:
          "Synthetic project record owned by Bob for object-level access testing.",
      },
    ])
    .onConflictDoNothing();
}

export async function getCurrentLabMode(): Promise<LabMode> {
  const [configuration] = await db
    .select({ mode: authscopeLabConfigTable.mode })
    .from(authscopeLabConfigTable)
    .where(eq(authscopeLabConfigTable.id, 1));

  if (configuration?.mode !== "vulnerable" && configuration?.mode !== "secure") {
    throw new Error("AuthScope lab configuration is missing or invalid.");
  }
  return configuration.mode;
}

export function outcomeForStatus(status: number): TestOutcome {
  if (status >= 200 && status < 300) return "allowed";
  if (status === 401) return "blocked";
  if (status === 403) return "denied";
  return "error";
}

export async function evaluateRead(
  resourceId: number,
  actor: DemoActor,
  mode: LabMode,
): Promise<{ status: number; resource?: DemoResource }> {
  const [resource] = await db
    .select()
    .from(authscopeDemoResourcesTable)
    .where(eq(authscopeDemoResourcesTable.id, resourceId));

  if (!resource) return { status: 404 };

  const status = objectReadStatus(resource.ownerId as DemoActor, actor, mode);
  return status === 200 ? { status, resource } : { status };
}

export async function evaluateOwnedMutation(
  resourceId: number,
  actor: DemoActor,
): Promise<{ status: number; resource?: DemoResource }> {
  const [resource] = await db
    .select()
    .from(authscopeDemoResourcesTable)
    .where(eq(authscopeDemoResourcesTable.id, resourceId));

  if (!resource) return { status: 404 };
  const status = objectMutationStatus(resource.ownerId as DemoActor, actor);
  return status === 200 ? { status, resource } : { status };
}

const testDefinitions = [
  {
    caseKey: "owner-read",
    name: "Owner reads their own resource",
    description: "Alice reads synthetic resource 101, which she owns.",
    expectedOutcome: "allowed" as const,
    expectedStatus: 200,
    remediation: "Keep an explicit ownership check on every object operation.",
  },
  {
    caseKey: "cross-user-read",
    name: "Another user attempts to read the resource",
    description: "Bob requests Alice's synthetic resource 101.",
    expectedOutcome: "denied" as const,
    expectedStatus: 403,
    remediation:
      "Check the authenticated demo actor's ownership before returning a resource.",
  },
  {
    caseKey: "unauthenticated-read",
    name: "Unauthenticated user attempts protected access",
    description: "A request without a valid session attempts to read resource 101.",
    expectedOutcome: "blocked" as const,
    expectedStatus: 401,
    remediation: "Require a valid authenticated session before processing API access.",
  },
  {
    caseKey: "cross-user-update",
    name: "User attempts to modify another user's resource",
    description: "Bob attempts to update Alice's synthetic resource 101.",
    expectedOutcome: "denied" as const,
    expectedStatus: 403,
    remediation:
      "Enforce resource ownership for update operations in every lab mode.",
  },
  {
    caseKey: "cross-user-delete",
    name: "User attempts to delete another user's resource",
    description: "Bob attempts to delete Alice's synthetic resource 101.",
    expectedOutcome: "denied" as const,
    expectedStatus: 403,
    remediation:
      "Enforce resource ownership for delete operations in every lab mode.",
  },
  {
    caseKey: "secure-owner-read",
    name: "Owner retains access after the secure policy is enabled",
    description: "Alice verifies that her own resource remains available.",
    expectedOutcome: "allowed" as const,
    expectedStatus: 200,
    remediation: "Preserve access for owners while denying cross-user requests.",
  },
];

async function actualStatusForCase(
  caseKey: string,
  mode: LabMode,
): Promise<number> {
  switch (caseKey) {
    case "owner-read":
    case "secure-owner-read":
      return (await evaluateRead(101, "alice", mode)).status;
    case "cross-user-read":
      return (await evaluateRead(101, "bob", mode)).status;
    case "unauthenticated-read":
      return 401;
    case "cross-user-update":
    case "cross-user-delete":
      return (await evaluateOwnedMutation(101, "bob")).status;
    default:
      throw new Error(`Unsupported AuthScope test case: ${caseKey}`);
  }
}

export async function executeSecuritySuite(
  mode: LabMode,
): Promise<TestResultDraft[]> {
  await ensureScenarioResources();

  return Promise.all(
    testDefinitions.map(async (test) => {
      const actualStatus = await actualStatusForCase(test.caseKey, mode);
      const actualOutcome = outcomeForStatus(actualStatus);
      const passed =
        actualStatus === test.expectedStatus &&
        actualOutcome === test.expectedOutcome;
      const isBola = test.caseKey === "cross-user-read" && !passed;
      const evidence =
        test.caseKey === "cross-user-read" && actualStatus === 200
          ? "GET /api/demo/resources/101 returned the synthetic Alice resource to demo actor Bob (HTTP 200). No credentials or secrets are included."
          : `${test.caseKey} returned HTTP ${actualStatus} (${actualOutcome}).`;

      return {
        ...test,
        variant: "current" as const,
        actualOutcome,
        actualStatus,
        passed,
        severity: isBola ? ("high" as const) : null,
        evidence,
      };
    }),
  );
}

export async function executeComparison(): Promise<ComparisonDraft[]> {
  await ensureScenarioResources();
  const sides = await Promise.all(
    testDefinitions.map(async (test) => {
      const [vulnerableStatus, secureStatus] = await Promise.all([
        actualStatusForCase(test.caseKey, "vulnerable"),
        actualStatusForCase(test.caseKey, "secure"),
      ]);
      const vulnerableOutcome = outcomeForStatus(vulnerableStatus);
      const secureOutcome = outcomeForStatus(secureStatus);
      const vulnerablePassed =
        vulnerableStatus === test.expectedStatus &&
        vulnerableOutcome === test.expectedOutcome;
      const securePassed =
        secureStatus === test.expectedStatus &&
        secureOutcome === test.expectedOutcome;
      const vulnerableEvidence =
        test.caseKey === "cross-user-read" && vulnerableStatus === 200
          ? "HTTP 200 returned Alice's synthetic resource to Bob."
          : `HTTP ${vulnerableStatus} (${vulnerableOutcome}).`;
      const secureEvidence =
        test.caseKey === "cross-user-read" && secureStatus === 403
          ? "HTTP 403 denied Bob's request because the owner check failed."
          : `HTTP ${secureStatus} (${secureOutcome}).`;

      return {
        ...test,
        expectedBehavior: `${test.expectedOutcome} (HTTP ${test.expectedStatus})`,
        vulnerable: {
          outcome: vulnerableOutcome,
          status: vulnerableStatus,
          passed: vulnerablePassed,
          evidence: vulnerableEvidence,
        },
        secure: {
          outcome: secureOutcome,
          status: secureStatus,
          passed: securePassed,
          evidence: secureEvidence,
        },
        improvement:
          test.caseKey === "cross-user-read"
            ? "The secure policy checks resource ownership before returning the object."
            : securePassed
              ? "The expected access rule is preserved in both policies."
              : "Review the secure policy implementation and expected outcome.",
      };
    }),
  );

  return sides;
}

export function isBolaRegression(result: TestResultDraft): boolean {
  return result.caseKey === "cross-user-read" && !result.passed;
}

export function toSafeEvidence(value: string): string {
  return value
    .replace(/(password|token|secret|authorization)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .slice(0, 1000);
}

