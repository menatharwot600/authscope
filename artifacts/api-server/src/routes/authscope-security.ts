import { Router, type IRouter } from "express";
import PDFDocument from "pdfkit";
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
} from "drizzle-orm";
import {
  db,
  authscopeAuditEventsTable,
  authscopeFindingsTable,
  authscopeTestResultsTable,
  authscopeTestRunsTable,
} from "@workspace/db";
import {
  GetFindingParams,
  GetFindingResponse,
  GetTestRunParams,
  GetTestRunReportParams,
  GetTestRunReportResponse,
  GetTestRunResponse,
  DownloadTestRunPdfParams,
  ListAuditEventsQueryParams,
  ListAuditEventsResponse,
  ListFindingsQueryParams,
  ListFindingsResponse,
  ListTestRunsQueryParams,
  ListTestRunsResponse,
  RunPolicyComparisonResponse,
  RunSecurityTestsResponse,
  UpdateFindingStatusBody,
  UpdateFindingStatusParams,
  UpdateFindingStatusResponse,
} from "@workspace/api-zod";
import {
  getAuthenticatedUserId,
  requireAuth,
} from "../lib/authscope-auth";
import { createActorRateLimit } from "../lib/authscope-rate-limit";
import {
  executeComparison,
  executeSecuritySuite,
  getCurrentLabMode,
  isBolaRegression,
  toSafeEvidence,
  type ResultVariant,
  type TestResultDraft,
} from "../lib/authscope-lab";

const router: IRouter = Router();
router.use(requireAuth);
const testExecutionLimit = createActorRateLimit(8, 60_000);

const bolaFinding = {
  title: "Broken Object Level Authorization (BOLA)",
  category: "BOLA",
  severity: "high",
  endpoint: "GET /api/demo/resources/{resourceId}",
  resourceId: 101,
  businessImpact:
    "An authenticated user can read synthetic records owned by another demo user. In a real system, the same flaw could expose another account's private data.",
  rootCause:
    "The vulnerable lab policy verifies authentication but intentionally omits the resource ownership check on the detail read.",
  remediation:
    "Derive the actor from the authenticated session and compare it to the resource owner before returning the object. Apply this check to every object-level read and mutation.",
} as const;

function resultPayload(
  run: typeof authscopeTestRunsTable.$inferSelect,
  results: (typeof authscopeTestResultsTable.$inferSelect)[],
) {
  return {
    ...run,
    results: results.map((result) => ({
      ...result,
      passed: result.passed,
      severity: result.severity,
    })),
  };
}

async function appendAudit(
  actorId: string,
  action: string,
  detail: string,
): Promise<void> {
  await db.insert(authscopeAuditEventsTable).values({ actorId, action, detail });
}

async function persistRun(
  userId: string,
  mode: "vulnerable" | "secure" | "comparison",
  results: Array<TestResultDraft & { variant: ResultVariant }>,
  durationMs: number,
): Promise<{
  run: typeof authscopeTestRunsTable.$inferSelect;
  results: (typeof authscopeTestResultsTable.$inferSelect)[];
}> {
  const failed = results.filter((result) => !result.passed).length;
  const findingCount = results.filter(isBolaRegression).length;

  return db.transaction(async (tx) => {
    const [run] = await tx
      .insert(authscopeTestRunsTable)
      .values({
        userId,
        mode,
        total: results.length,
        passed: results.length - failed,
        failed,
        findings: findingCount,
        durationMs,
      })
      .returning();
    if (!run) throw new Error("Test run could not be persisted.");

    const storedResults =
      results.length === 0
        ? []
        : await tx
            .insert(authscopeTestResultsTable)
            .values(
              results.map((result) => ({
                runId: run.id,
                caseKey: result.caseKey,
                name: result.name,
                description: result.description,
                variant: result.variant,
                expectedOutcome: result.expectedOutcome,
                expectedStatus: result.expectedStatus,
                actualOutcome: result.actualOutcome,
                actualStatus: result.actualStatus,
                passed: result.passed,
                severity: result.severity,
                evidence: toSafeEvidence(result.evidence),
                remediation: result.remediation,
              })),
            )
            .returning();

    for (const result of results.filter(isBolaRegression)) {
      await tx.insert(authscopeFindingsTable).values({
        userId,
        ...bolaFinding,
        evidence: toSafeEvidence(result.evidence),
        runId: run.id,
      });
    }

    await tx.insert(authscopeAuditEventsTable).values({
      actorId: userId,
      action: mode === "comparison" ? "comparison.executed" : "security.tests.executed",
      detail: `Saved ${results.length} authorization test result${results.length === 1 ? "" : "s"} in ${mode} mode; ${findingCount} BOLA finding${findingCount === 1 ? "" : "s"} recorded.`,
    });

    return { run, results: storedResults };
  });
}

async function findOwnedRun(runId: number, userId: string) {
  const [run] = await db
    .select()
    .from(authscopeTestRunsTable)
    .where(
      and(
        eq(authscopeTestRunsTable.id, runId),
        eq(authscopeTestRunsTable.userId, userId),
      ),
    );
  if (!run) return null;
  const results = await db
    .select()
    .from(authscopeTestResultsTable)
    .where(eq(authscopeTestResultsTable.runId, run.id))
    .orderBy(authscopeTestResultsTable.id);
  return resultPayload(run, results);
}

function reportFromRun(run: ReturnType<typeof resultPayload>) {
  const uniqueRemediation = Array.from(
    new Set(run.results.map((result) => result.remediation)),
  );
  return GetTestRunReportResponse.parse({
    title: `AuthScope Security Test Report — Run ${run.id}`,
    generatedAt: new Date(),
    summary: `${run.total} checks executed in ${run.mode} mode: ${run.passed} passed, ${run.failed} failed, and ${run.findings} BOLA finding${run.findings === 1 ? "" : "s"} recorded.`,
    run,
    remediation: uniqueRemediation,
  });
}

router.post("/tests/runs", testExecutionLimit, async (_req, res): Promise<void> => {
  const start = Date.now();
  const mode = await getCurrentLabMode();
  const results = await executeSecuritySuite(mode);
  const stored = await persistRun(
    getAuthenticatedUserId(res),
    mode,
    results,
    Math.max(1, Date.now() - start),
  );
  res
    .status(201)
    .json(RunSecurityTestsResponse.parse(resultPayload(stored.run, stored.results)));
});

router.post("/comparison/runs", testExecutionLimit, async (_req, res): Promise<void> => {
  const start = Date.now();
  const comparisons = await executeComparison();
  const bothModes = await Promise.all([
    executeSecuritySuite("vulnerable"),
    executeSecuritySuite("secure"),
  ]);
  const persistedResults = [
    ...bothModes[0].map((result) => ({ ...result, variant: "vulnerable" as const })),
    ...bothModes[1].map((result) => ({ ...result, variant: "secure" as const })),
  ];
  const stored = await persistRun(
    getAuthenticatedUserId(res),
    "comparison",
    persistedResults,
    Math.max(1, Date.now() - start),
  );
  const failedBola = comparisons.some(
    (item) => item.caseKey === "cross-user-read" && !item.vulnerable.passed,
  );
  const summary = failedBola
    ? "The same authenticated request exposed Alice's synthetic resource in Vulnerable mode and was denied by the ownership check in Secure mode."
    : "The comparison completed using both backend policies. Review the cases below for the observed HTTP outcomes.";
  res.status(201).json(
    RunPolicyComparisonResponse.parse({
      id: stored.run.id,
      createdAt: stored.run.createdAt,
      cases: comparisons,
      summary,
    }),
  );
});

router.get("/tests/runs", async (req, res): Promise<void> => {
  const query = ListTestRunsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "The test history filters are invalid." });
    return;
  }

  const userId = getAuthenticatedUserId(res);
  const { mode, result, search, from, to, page, pageSize } = query.data;
  const conditions = [eq(authscopeTestRunsTable.userId, userId)];
  if (mode) conditions.push(eq(authscopeTestRunsTable.mode, mode));
  if (result === "passed") conditions.push(eq(authscopeTestRunsTable.failed, 0));
  if (result === "failed") conditions.push(sql`${authscopeTestRunsTable.failed} > 0`);
  if (from) conditions.push(gte(authscopeTestRunsTable.createdAt, new Date(`${from}T00:00:00.000Z`)));
  if (to) conditions.push(lte(authscopeTestRunsTable.createdAt, new Date(`${to}T23:59:59.999Z`)));
  if (search) {
    const match = `%${search}%`;
    conditions.push(
      or(
        ilike(authscopeTestRunsTable.mode, match),
        ilike(sql`${authscopeTestRunsTable.id}::text`, match),
      )!,
    );
  }
  const where = and(...conditions);
  const [{ total }] = await db
    .select({ total: count() })
    .from(authscopeTestRunsTable)
    .where(where);
  const items = await db
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
    .where(where)
    .orderBy(desc(authscopeTestRunsTable.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  res.json(
    ListTestRunsResponse.parse({
      items,
      total,
      page,
      pageSize,
    }),
  );
});

router.get("/tests/runs/:runId", async (req, res): Promise<void> => {
  const params = GetTestRunParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Run ID must be a positive integer." });
    return;
  }
  const run = await findOwnedRun(params.data.runId, getAuthenticatedUserId(res));
  if (!run) {
    res.status(404).json({ error: "Test run not found." });
    return;
  }
  res.json(GetTestRunResponse.parse(run));
});

router.get("/tests/runs/:runId/report", async (req, res): Promise<void> => {
  const params = GetTestRunReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Run ID must be a positive integer." });
    return;
  }
  const run = await findOwnedRun(params.data.runId, getAuthenticatedUserId(res));
  if (!run) {
    res.status(404).json({ error: "Test run not found." });
    return;
  }
  await appendAudit(
    getAuthenticatedUserId(res),
    "report.generated.json",
    `Generated JSON report for test run ${run.id}.`,
  );
  res.json(reportFromRun(run));
});

router.get("/tests/runs/:runId/report.pdf", async (req, res): Promise<void> => {
  const params = DownloadTestRunPdfParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Run ID must be a positive integer." });
    return;
  }
  const run = await findOwnedRun(params.data.runId, getAuthenticatedUserId(res));
  if (!run) {
    res.status(404).json({ error: "Test run not found." });
    return;
  }

  await appendAudit(
    getAuthenticatedUserId(res),
    "report.generated.pdf",
    `Generated PDF report for test run ${run.id}.`,
  );
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="authscope-run-${run.id}.pdf"`,
  );
  const document = new PDFDocument({ margin: 48, size: "A4" });
  document.pipe(res);
  document.fontSize(20).font("Helvetica-Bold").text("AuthScope Security Report");
  document.moveDown(0.5);
  document
    .fontSize(10)
    .font("Helvetica")
    .text(`Run ${run.id} · ${run.mode} mode · ${run.createdAt.toISOString()}`);
  document.moveDown(0.5);
  document
    .fontSize(12)
    .font("Helvetica-Bold")
    .text(`${run.total} checks · ${run.passed} passed · ${run.failed} failed · ${run.findings} findings`);
  document.moveDown();
  document
    .fontSize(10)
    .font("Helvetica")
    .text("Scope: AuthScope's controlled demo API and synthetic Alice/Bob resources only.");
  document.moveDown();
  for (const [index, result] of run.results.entries()) {
    document
      .font("Helvetica-Bold")
      .text(`${index + 1}. ${result.name} — ${result.passed ? "PASS" : "FAIL"}`);
    document
      .font("Helvetica")
      .text(`Expected HTTP ${result.expectedStatus}; actual HTTP ${result.actualStatus} (${result.actualOutcome}).`);
    document.text(`Evidence: ${result.evidence}`);
    document.text(`Remediation: ${result.remediation}`);
    document.moveDown(0.7);
  }
  document.end();
});

router.get("/findings", async (req, res): Promise<void> => {
  const query = ListFindingsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "The finding filters are invalid." });
    return;
  }
  const userId = getAuthenticatedUserId(res);
  const { status, severity, search, page, pageSize } = query.data;
  const conditions = [eq(authscopeFindingsTable.userId, userId)];
  if (status) conditions.push(eq(authscopeFindingsTable.status, status));
  if (severity) conditions.push(eq(authscopeFindingsTable.severity, severity));
  if (search) {
    const match = `%${search}%`;
    conditions.push(
      or(
        ilike(authscopeFindingsTable.title, match),
        ilike(authscopeFindingsTable.endpoint, match),
        ilike(authscopeFindingsTable.category, match),
      )!,
    );
  }
  const where = and(...conditions);
  const [{ total }] = await db
    .select({ total: count() })
    .from(authscopeFindingsTable)
    .where(where);
  const items = await db
    .select()
    .from(authscopeFindingsTable)
    .where(where)
    .orderBy(desc(authscopeFindingsTable.discoveredAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  res.json(
    ListFindingsResponse.parse({
      items,
      total,
      page,
      pageSize,
    }),
  );
});

router.get("/findings/:findingId", async (req, res): Promise<void> => {
  const params = GetFindingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Finding ID must be a positive integer." });
    return;
  }
  const [finding] = await db
    .select()
    .from(authscopeFindingsTable)
    .where(
      and(
        eq(authscopeFindingsTable.id, params.data.findingId),
        eq(authscopeFindingsTable.userId, getAuthenticatedUserId(res)),
      ),
    );
  if (!finding) {
    res.status(404).json({ error: "Finding not found." });
    return;
  }
  res.json(GetFindingResponse.parse(finding));
});

router.patch("/findings/:findingId", async (req, res): Promise<void> => {
  const params = UpdateFindingStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Finding ID must be a positive integer." });
    return;
  }
  const input = UpdateFindingStatusBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Choose Open, Fixed, or Accepted." });
    return;
  }
  const userId = getAuthenticatedUserId(res);
  const [updated] = await db
    .update(authscopeFindingsTable)
    .set({ status: input.data.status, updatedAt: new Date() })
    .where(
      and(
        eq(authscopeFindingsTable.id, params.data.findingId),
        eq(authscopeFindingsTable.userId, userId),
      ),
    )
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Finding not found." });
    return;
  }

  await appendAudit(
    userId,
    "finding.status.changed",
    `Changed finding ${updated.id} status to ${updated.status}.`,
  );
  res.json(UpdateFindingStatusResponse.parse(updated));
});

router.get("/audit-log", async (req, res): Promise<void> => {
  const query = ListAuditEventsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "The audit log pagination is invalid." });
    return;
  }
  const { page, pageSize } = query.data;
  const actorId = getAuthenticatedUserId(res);
  const where = eq(authscopeAuditEventsTable.actorId, actorId);
  const [{ total }] = await db
    .select({ total: count() })
    .from(authscopeAuditEventsTable)
    .where(where);
  const items = await db
    .select()
    .from(authscopeAuditEventsTable)
    .where(where)
    .orderBy(desc(authscopeAuditEventsTable.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  res.json(
    ListAuditEventsResponse.parse({
      items,
      total,
      page,
      pageSize,
    }),
  );
});

export default router;
