import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  authscopeAuditEventsTable,
  authscopeDemoResourcesTable,
} from "@workspace/db";
import {
  CreateDemoResourceBody,
  CreateDemoResourceResponse,
  DeleteDemoResourceParams,
  GetDemoResourceParams,
  GetDemoResourceResponse,
  ListDemoResourcesHeader,
  ListDemoResourcesResponse,
  UpdateDemoResourceBody,
  UpdateDemoResourceParams,
  UpdateDemoResourceResponse,
} from "@workspace/api-zod";
import {
  getAuthenticatedUserId,
  requireAuth,
} from "../lib/authscope-auth";
import {
  actorNames,
  evaluateOwnedMutation,
  evaluateRead,
  getCurrentLabMode,
  type DemoActor,
} from "../lib/authscope-lab";

const router: IRouter = Router();
router.use(requireAuth);

function parseActor(req: Request, res: Response): DemoActor | null {
  const parsed = ListDemoResourcesHeader.safeParse({
    "X-Demo-User": req.get("X-Demo-User"),
  });
  if (!parsed.success) {
    res.status(400).json({
      error: "X-Demo-User must be either alice or bob.",
    });
    return null;
  }
  return parsed.data["X-Demo-User"];
}

router.get("/demo/resources", async (req, res): Promise<void> => {
  const actor = parseActor(req, res);
  if (!actor) return;

  const resources = await db
    .select()
    .from(authscopeDemoResourcesTable)
    .where(eq(authscopeDemoResourcesTable.ownerId, actor))
    .orderBy(asc(authscopeDemoResourcesTable.id));
  res.json(ListDemoResourcesResponse.parse(resources));
});

router.post("/demo/resources", async (req, res): Promise<void> => {
  const actor = parseActor(req, res);
  if (!actor) return;

  const input = CreateDemoResourceBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Provide a valid synthetic resource name and description." });
    return;
  }

  const [resource] = await db
    .insert(authscopeDemoResourcesTable)
    .values({
      ownerId: actor,
      ownerName: actorNames[actor],
      name: input.data.name,
      description: input.data.description,
    })
    .returning();

  await db.insert(authscopeAuditEventsTable).values({
    actorId: getAuthenticatedUserId(res),
    action: "demo.resource.created",
    detail: `Created synthetic resource ${resource.id} for demo actor ${actor}.`,
  });
  res.status(201).json(CreateDemoResourceResponse.parse(resource));
});

router.get("/demo/resources/:resourceId", async (req, res): Promise<void> => {
  const actor = parseActor(req, res);
  if (!actor) return;

  const params = GetDemoResourceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Resource ID must be a positive integer." });
    return;
  }

  const decision = await evaluateRead(
    params.data.resourceId,
    actor,
    await getCurrentLabMode(),
  );
  if (!decision.resource) {
    res.status(decision.status).json({ error: "Synthetic resource not found." });
    return;
  }
  res.json(GetDemoResourceResponse.parse(decision.resource));
});

router.patch(
  "/demo/resources/:resourceId",
  async (req, res): Promise<void> => {
    const actor = parseActor(req, res);
    if (!actor) return;

    const params = UpdateDemoResourceParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Resource ID must be a positive integer." });
      return;
    }
    const input = UpdateDemoResourceBody.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ error: "Provide at least one valid resource field." });
      return;
    }

    const decision = await evaluateOwnedMutation(params.data.resourceId, actor);
    if (!decision.resource) {
      res.status(decision.status).json({ error: "Synthetic resource not found." });
      return;
    }

    const [updated] = await db
      .update(authscopeDemoResourcesTable)
      .set({ ...input.data, updatedAt: new Date() })
      .where(
        and(
          eq(authscopeDemoResourcesTable.id, params.data.resourceId),
          eq(authscopeDemoResourcesTable.ownerId, actor),
        ),
      )
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Synthetic resource not found." });
      return;
    }

    await db.insert(authscopeAuditEventsTable).values({
      actorId: getAuthenticatedUserId(res),
      action: "demo.resource.updated",
      detail: `Updated synthetic resource ${updated.id} owned by ${actor}.`,
    });
    res.json(UpdateDemoResourceResponse.parse(updated));
  },
);

router.delete(
  "/demo/resources/:resourceId",
  async (req, res): Promise<void> => {
    const actor = parseActor(req, res);
    if (!actor) return;

    const params = DeleteDemoResourceParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Resource ID must be a positive integer." });
      return;
    }

    const decision = await evaluateOwnedMutation(params.data.resourceId, actor);
    if (!decision.resource) {
      res.status(decision.status).json({ error: "Synthetic resource not found." });
      return;
    }

    await db
      .delete(authscopeDemoResourcesTable)
      .where(
        and(
          eq(authscopeDemoResourcesTable.id, params.data.resourceId),
          eq(authscopeDemoResourcesTable.ownerId, actor),
        ),
      );
    await db.insert(authscopeAuditEventsTable).values({
      actorId: getAuthenticatedUserId(res),
      action: "demo.resource.deleted",
      detail: `Deleted synthetic resource ${params.data.resourceId} owned by ${actor}.`,
    });
    res.status(204).send();
  },
);

export default router;
