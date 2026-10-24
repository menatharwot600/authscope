import { Router, type IRouter } from "express";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import {
  db,
  authscopeAuditEventsTable,
  authscopeFindingsTable,
  authscopeLabConfigTable,
  authscopeTestRunsTable,
} from "@workspace/db";
import {
  GetCurrentAccountResponse,
  GetDashboardSummaryResponse,
  GetLabConfigurationResponse,
  UpdateLabModeBody,
  UpdateLabModeResponse,
} from "@workspace/api-zod";
import {
  getAuthenticatedUserId,
  requireAuth,
} from "../lib/authscope-auth";
import { getCurrentLabMode } from "../lib/authscope-lab";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/me", (_req, res): void => {
  const account = GetCurrentAccountResponse.parse({
    userId: getAuthenticatedUserId(res),
    authProvider: "clerk",
  });
  res.json(account);
});

router.get("/lab", async (_req, res): Promise<void> => {
  const [configuration] = await db
    .select({
      mode: authscopeLabConfigTable.mode,
      updatedAt: authscopeLabConfigTable.updatedAt,
    })
    .from(authscopeLabConfigTable)
    .where(eq(authscopeLabConfigTable.id, 1));

  if (!configuration) {
    res.status(503).json({ error: "Lab configuration is not initialized." });
    return;
  }

  res.json(GetLabConfigurationResponse.parse(configuration));
});

router.patch("/lab", async (req, res): Promise<void> => {
  const input = UpdateLabModeBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Choose either Vulnerable or Secure mode." });
    return;
  }

  const userId = getAuthenticatedUserId(res);
  const currentMode = await getCurrentLabMode();
  if (currentMode === input.data.mode) {
    const [unchanged] = await db
      .select({
        mode: authscopeLabConfigTable.mode,
        updatedAt: authscopeLabConfigTable.updatedAt,
      })
      .from(authscopeLabConfigTable)
      .where(eq(authscopeLabConfigTable.id, 1));
    res.json(UpdateLabModeResponse.parse(unchanged));
    return;
  }

  const now = new Date();
  const [updated] = await db.transaction(async (tx) => {
    const [configuration] = await tx
      .update(authscopeLabConfigTable)
      .set({
        mode: input.data.mode,
        updatedBy: userId,
        updatedAt: now,
      })
      .where(eq(authscopeLabConfigTable.id, 1))
      .returning({
        mode: authscopeLabConfigTable.mode,
        updatedAt: authscopeLabConfigTable.updatedAt,
      });

    if (input.data.mode === "secure") {
      await tx
        .update(authscopeFindingsTable)
        .set({ status: "fixed", updatedAt: now })
        .where(
          and(
            eq(authscopeFindingsTable.userId, userId),
            eq(authscopeFindingsTable.category, "BOLA"),
            eq(authscopeFindingsTable.status, "open"),
          ),
        );
    }

    await tx.insert(authscopeAuditEventsTable).values({
      actorId: userId,
      action: "lab.mode.changed",
      detail: `Lab policy changed from ${currentMode} to ${input.data.mode}.`,
    });
    return [configuration];
  });

  if (!updated) {
    res.status(500).json({ error: "The lab policy could not be updated." });
    return;
  }
  res.json(UpdateLabModeResponse.parse(updated));
});

router.get("/dashboard", async (_req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(res);
  const mode = await getCurrentLabMode();
  const [totals] = await db
    .select({
      testsExecuted: sql<number>`coalesce(sum(${authscopeTestRunsTable.total}), 0)`,
      testsPassed: sql<number>`coalesce(sum(${authscopeTestRunsTable.passed}), 0)`,
      testsFailed: sql<number>`coalesce(sum(${authscopeTestRunsTable.failed}), 0)`,
    })
    .from(authscopeTestRunsTable)
    .where(eq(authscopeTestRunsTable.userId, userId));

  const [findingTotals] = await db
    .select({
      detected: sql<number>`count(*) filter (where ${authscopeFindingsTable.status} <> 'fixed')`,
      fixed: sql<number>`count(*) filter (where ${authscopeFindingsTable.status} = 'fixed')`,
    })
    .from(authscopeFindingsTable)
    .where(eq(authscopeFindingsTable.userId, userId));

  const severityRows = await db
    .select({
      severity: authscopeFindingsTable.severity,
      count: count(),
    })
    .from(authscopeFindingsTable)
    .where(
      and(
        eq(authscopeFindingsTable.userId, userId),
        eq(authscopeFindingsTable.status, "open"),
      ),
    )
    .groupBy(authscopeFindingsTable.severity);

  const trendRows = await db
    .select({
      passed: authscopeTestRunsTable.passed,
      failed: authscopeTestRunsTable.failed,
      createdAt: authscopeTestRunsTable.createdAt,
    })
    .from(authscopeTestRunsTable)
    .where(
      and(
        eq(authscopeTestRunsTable.userId, userId),
        gte(
          authscopeTestRunsTable.createdAt,
          new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        ),
      ),
    )
    .orderBy(desc(authscopeTestRunsTable.createdAt));

  const trendByDate = new Map<string, { passed: number; failed: number }>();
  for (const row of trendRows) {
    const date = row.createdAt.toISOString().slice(0, 10);
    const current = trendByDate.get(date) ?? { passed: 0, failed: 0 };
    current.passed += row.passed;
    current.failed += row.failed;
    trendByDate.set(date, current);
  }
  const trend = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (6 - offset));
    const key = date.toISOString().slice(0, 10);
    const values = trendByDate.get(key) ?? { passed: 0, failed: 0 };
    return { date: key, ...values };
  });

  const recentRuns = await db
    .select({
      id: authscopeTestRunsTable.id,
      mode: authscopeTestRunsTable.mode,
      total: authscopeTestRunsTable.total,
      passed: authscopeTestRunsTable.passed,
      failed: authscopeTestRunsTable.failed,
      findings: authscopeTestRunsTable.findings,
      durationMs: authscopeTestRunsTable.durationMs,
      createdAt: authscopeTestRunsTable.createdAt,
    })
    .from(authscopeTestRunsTable)
    .where(eq(authscopeTestRunsTable.userId, userId))
    .orderBy(desc(authscopeTestRunsTable.createdAt))
    .limit(5);

  const summary = GetDashboardSummaryResponse.parse({
    mode,
    testsExecuted: Number(totals?.testsExecuted ?? 0),
    testsPassed: Number(totals?.testsPassed ?? 0),
    testsFailed: Number(totals?.testsFailed ?? 0),
    vulnerabilitiesDetected: Number(findingTotals?.detected ?? 0),
    vulnerabilitiesFixed: Number(findingTotals?.fixed ?? 0),
    trend,
    findingsBySeverity: severityRows.map((row) => ({
      severity: row.severity,
      count: row.count,
    })),
    recentRuns,
  });
  res.json(summary);
});

export default router;
