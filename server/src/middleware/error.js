import { HttpError } from "../lib/http-error.js";

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: "not_found",
    message: `No route matches ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(err, _req, res, _next) {
  const status = err instanceof HttpError ? err.status : Number(err.status || err.statusCode || 500);
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  const payload = {
    error: safeStatus >= 500 ? "internal_server_error" : "request_failed",
    message: safeStatus >= 500 ? "Internal server error" : err.message,
  };

  if (err instanceof HttpError && err.details !== undefined) payload.details = err.details;
  if (safeStatus >= 500) console.error(err);

  res.status(safeStatus).json(payload);
}
