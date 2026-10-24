import { Router, type IRouter } from "express";
import healthRouter from "./health";
import apiDocsRouter from "./api-docs";
import authscopeCoreRouter from "./authscope-core";
import authscopeDemoRouter from "./authscope-demo";
import authscopeSecurityRouter from "./authscope-security";

const router: IRouter = Router();

router.use(healthRouter);
router.use(apiDocsRouter);
router.use(authscopeCoreRouter);
router.use(authscopeDemoRouter);
router.use(authscopeSecurityRouter);

export default router;
