import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const authscopeLabConfigTable = pgTable("authscope_lab_config", {
  id: integer("id").primaryKey(),
  mode: text("mode").notNull().default("secure"),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const authscopeDemoResourcesTable = pgTable("authscope_demo_resources", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  ownerName: text("owner_name").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const authscopeTestRunsTable = pgTable("authscope_test_runs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  mode: text("mode").notNull(),
  total: integer("total").notNull().default(0),
  passed: integer("passed").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  findings: integer("findings").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const authscopeTestResultsTable = pgTable(
  "authscope_test_results",
  {
    id: serial("id").primaryKey(),
    runId: integer("run_id")
      .notNull()
      .references(() => authscopeTestRunsTable.id, { onDelete: "cascade" }),
    caseKey: text("case_key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    variant: text("variant").notNull().default("current"),
    expectedOutcome: text("expected_outcome").notNull(),
    expectedStatus: integer("expected_status").notNull(),
    actualOutcome: text("actual_outcome").notNull(),
    actualStatus: integer("actual_status").notNull(),
    passed: boolean("passed").notNull(),
    severity: text("severity"),
    evidence: text("evidence").notNull(),
    remediation: text("remediation").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const authscopeFindingsTable = pgTable(
  "authscope_findings",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    severity: text("severity").notNull(),
    endpoint: text("endpoint").notNull(),
    resourceId: integer("resource_id").notNull(),
    evidence: text("evidence").notNull(),
    businessImpact: text("business_impact").notNull(),
    rootCause: text("root_cause").notNull(),
    remediation: text("remediation").notNull(),
    status: text("status").notNull().default("open"),
    runId: integer("run_id")
      .notNull()
      .references(() => authscopeTestRunsTable.id, { onDelete: "cascade" }),
    discoveredAt: timestamp("discovered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const authscopeAuditEventsTable = pgTable("authscope_audit_events", {
  id: serial("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  detail: text("detail").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAuthscopeLabConfigSchema = createInsertSchema(
  authscopeLabConfigTable,
).omit({ updatedAt: true });
export const insertAuthscopeDemoResourceSchema = createInsertSchema(
  authscopeDemoResourcesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAuthscopeTestRunSchema = createInsertSchema(
  authscopeTestRunsTable,
).omit({ id: true, createdAt: true });
export const insertAuthscopeTestResultSchema = createInsertSchema(
  authscopeTestResultsTable,
).omit({ id: true, createdAt: true });
export const insertAuthscopeFindingSchema = createInsertSchema(
  authscopeFindingsTable,
).omit({ id: true, discoveredAt: true, updatedAt: true });
export const insertAuthscopeAuditEventSchema = createInsertSchema(
  authscopeAuditEventsTable,
).omit({ id: true, createdAt: true });

export type AuthscopeLabConfig = typeof authscopeLabConfigTable.$inferSelect;
export type InsertAuthscopeLabConfig = z.infer<
  typeof insertAuthscopeLabConfigSchema
>;
export type AuthscopeDemoResource =
  typeof authscopeDemoResourcesTable.$inferSelect;
export type InsertAuthscopeDemoResource = z.infer<
  typeof insertAuthscopeDemoResourceSchema
>;
export type AuthscopeTestRun = typeof authscopeTestRunsTable.$inferSelect;
export type InsertAuthscopeTestRun = z.infer<
  typeof insertAuthscopeTestRunSchema
>;
export type AuthscopeTestResult =
  typeof authscopeTestResultsTable.$inferSelect;
export type InsertAuthscopeTestResult = z.infer<
  typeof insertAuthscopeTestResultSchema
>;
export type AuthscopeFinding = typeof authscopeFindingsTable.$inferSelect;
export type InsertAuthscopeFinding = z.infer<
  typeof insertAuthscopeFindingSchema
>;
export type AuthscopeAuditEvent =
  typeof authscopeAuditEventsTable.$inferSelect;
export type InsertAuthscopeAuditEvent = z.infer<
  typeof insertAuthscopeAuditEventSchema
>;
