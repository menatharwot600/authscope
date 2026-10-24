import { Router, type IRouter } from "express";
import swaggerUi from "swagger-ui-express";
import openApiDocument from "../lib/openapi-document";

const router: IRouter = Router();

router.get("/openapi.json", (_req, res): void => {
  res.json(openApiDocument);
});

router.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, { customSiteTitle: "AuthScope API" }),
);

export default router;
