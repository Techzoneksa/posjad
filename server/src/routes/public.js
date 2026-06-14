import { Router } from "express";

import { verifyPublicHmac } from "../middleware/hmac.js";

export const publicRouter = Router();

publicRouter.use(verifyPublicHmac);

publicRouter.post("/:provider/:event", (req, res) => {
  res.json({
    ok: true,
    provider: req.params.provider,
    event: req.params.event,
    receivedAt: new Date().toISOString(),
  });
});
