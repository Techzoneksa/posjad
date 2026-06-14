package com.yellowchicken.zatca;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Executors;

/**
 * Plain-Java HTTP signing service (no Spring). Wraps the official ZATCA Java SDK.
 *
 * Endpoints:
 *   GET  /health   -> 200 {"ok":true,"service":"zatca-signing-service"}   (no auth)
 *   POST /sign     -> 200 SignResponse                                    (Bearer SIGNING_SERVICE_SECRET)
 *
 * All handlers are wrapped in try/catch so a thrown exception never causes the
 * JDK HttpServer to silently reset the connection (curl: "Recv failure:
 * Connection reset by peer"). Anything unhandled becomes a 500 with a tiny
 * JSON body and is logged to stderr.
 */
public class SigningServiceApplication {

    private static final ObjectMapper MAPPER =
        new ObjectMapper().disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private static final String SERVICE_NAME = "zatca-signing-service";
    private static final String HEALTH_BODY =
        "{\"ok\":true,\"service\":\"" + SERVICE_NAME + "\"}";
    private static final String INTERNAL_ERROR_BODY =
        "{\"ok\":false,\"error\":\"internal_error\"}";

    public static void main(String[] args) throws Exception {
        int port = parsePort(System.getenv("PORT"), 8080);
        String secret = System.getenv("SIGNING_SERVICE_SECRET");
        if (secret == null || secret.isBlank()) {
            log("WARN  SIGNING_SERVICE_SECRET is not set — /sign will refuse all requests.");
        }

        HttpServer server = HttpServer.create(new InetSocketAddress("0.0.0.0", port), 0);
        server.createContext("/health", new HealthHandler());
        server.createContext("/sign", new SignHandler(secret));
        server.setExecutor(Executors.newFixedThreadPool(8));
        server.start();
        log("INFO  zatca-signing-service listening on 0.0.0.0:" + port);
    }

    private static int parsePort(String v, int fallback) {
        if (v == null || v.isBlank()) return fallback;
        try { return Integer.parseInt(v.trim()); } catch (Exception e) { return fallback; }
    }

    // ---------------- /health ----------------
    static class HealthHandler implements HttpHandler {
        @Override public void handle(HttpExchange ex) {
            String method = ex.getRequestMethod();
            String path = ex.getRequestURI().getPath();
            int status = 200;
            Throwable caught = null;
            try {
                if (!"GET".equalsIgnoreCase(method)) {
                    status = 405;
                    writeBody(ex, status, "{\"ok\":false,\"error\":\"method_not_allowed\"}");
                    return;
                }
                writeBody(ex, status, HEALTH_BODY);
            } catch (Throwable t) {
                caught = t;
                status = 500;
                safeWrite500(ex);
            } finally {
                logRequest(method, path, status, caught);
                ex.close();
            }
        }
    }

    // ---------------- /sign ----------------
    static class SignHandler implements HttpHandler {
        private final String expectedSecret;
        // Lazy-init the SDK adapter so any classpath/SDK loading error
        // surfaces as a 500 on /sign instead of breaking handler construction.
        private volatile ZatcaSdkAdapter sdk;

        SignHandler(String expectedSecret) { this.expectedSecret = expectedSecret; }

        private ZatcaSdkAdapter sdk() {
            ZatcaSdkAdapter s = sdk;
            if (s == null) {
                synchronized (this) {
                    if (sdk == null) sdk = new ZatcaSdkAdapter();
                    s = sdk;
                }
            }
            return s;
        }

        @Override public void handle(HttpExchange ex) {
            String method = ex.getRequestMethod();
            String path = ex.getRequestURI().getPath();
            int status = 200;
            Throwable caught = null;
            try {
                if (!"POST".equalsIgnoreCase(method)) {
                    status = 405;
                    writeJson(ex, status, Map.of("error", "method_not_allowed"));
                    return;
                }
                if (expectedSecret == null || expectedSecret.isBlank()) {
                    status = 500;
                    writeJson(ex, status, Map.of("error", "SIGNING_SERVICE_SECRET not configured"));
                    return;
                }
                String auth = ex.getRequestHeaders().getFirst("Authorization");
                if (auth == null || !auth.startsWith("Bearer ")) {
                    status = 401;
                    writeJson(ex, status, Map.of("error", "missing bearer token"));
                    return;
                }
                String token = auth.substring("Bearer ".length()).trim();
                if (!constantTimeEquals(token, expectedSecret)) {
                    status = 401;
                    writeJson(ex, status, Map.of("error", "invalid bearer token"));
                    return;
                }

                byte[] raw;
                try (InputStream is = ex.getRequestBody()) {
                    raw = is.readAllBytes();
                }
                JsonNode json = MAPPER.readTree(raw);

                SignRequest req = new SignRequest();
                req.unsignedXml    = textOrNull(json, "unsignedXml");
                req.privateKeyPem  = textOrNull(json, "privateKeyPem");
                req.certificatePem = textOrNull(json, "certificatePem");
                req.pihBase64      = textOrNull(json, "pihBase64");
                req.invoiceUuid    = textOrNull(json, "invoiceUuid");
                req.icv = json.hasNonNull("icv") ? json.get("icv").asInt() : null;

                String missing = validate(req);
                if (missing != null) {
                    status = 400;
                    writeJson(ex, status, Map.of("error", "validation_failed", "field", missing));
                    return;
                }

                SignResponse out = sdk().signInvoice(req);
                writeJson(ex, status, out);
            } catch (ZatcaSdkAdapter.UnsignedXmlNormalizationException nx) {
                caught = nx;
                status = 400;
                Map<String, Object> body = new LinkedHashMap<>();
                body.put("error", nx.code);
                body.put("message", nx.getMessage());
                body.put("stage", "normalizeUnsignedXml");
                if (nx.diagnostics != null) body.put("prologDiagnostics", nx.diagnostics);
                try {
                    writeJson(ex, status, body);
                } catch (Throwable ignored) {
                    safeWrite500(ex);
                }
            } catch (ZatcaSdkAdapter.SdkSigningDiagnosticsException dx) {
                caught = dx;
                status = 500;
                Map<String, Object> body = new LinkedHashMap<>();
                body.put("error", dx.errorClass);
                body.put("message", String.valueOf(dx.getMessage()));
                body.put("stage", dx.stage);
                body.put("sdkVersion", ZatcaSdkAdapter.SDK_VERSION);
                if (dx.prologDiagnostics != null) body.put("prologDiagnostics", dx.prologDiagnostics);
                body.put("availableSignatures", dx.availableSignatures);
                try {
                    writeJson(ex, status, body);
                } catch (Throwable ignored) {
                    safeWrite500(ex);
                }
            } catch (Throwable t) {
                caught = t;
                status = 500;
                // Never include request payload (keys, XML) in the response or log.
                try {
                    writeJson(ex, status, Map.of(
                        "error", t.getClass().getSimpleName(),
                        "message", String.valueOf(t.getMessage())
                    ));
                } catch (Throwable ignored) {
                    safeWrite500(ex);
                }
            } finally {
                logRequest(method, path, status, caught);
                ex.close();
            }
        }

        private static String textOrNull(JsonNode n, String f) {
            return n != null && n.hasNonNull(f) ? n.get(f).asText() : null;
        }

        private static String validate(SignRequest r) {
            if (isBlank(r.unsignedXml))     return "unsignedXml";
            if (isBlank(r.privateKeyPem))   return "privateKeyPem";
            if (isBlank(r.certificatePem))  return "certificatePem";
            if (isBlank(r.pihBase64))       return "pihBase64";
            if (isBlank(r.invoiceUuid))     return "invoiceUuid";
            if (r.icv == null)              return "icv";
            return null;
        }
        private static boolean isBlank(String s) { return s == null || s.isBlank(); }
    }

    // ---------------- response helpers ----------------

    /** Write a raw JSON string body with explicit Content-Length. */
    static void writeBody(HttpExchange ex, int status, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
    }

    /** Serialize body with Jackson, then write. */
    static void writeJson(HttpExchange ex, int status, Object body) throws IOException {
        byte[] bytes = MAPPER.writeValueAsBytes(body);
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
    }

    /** Last-ditch 500 writer that never throws. */
    static void safeWrite500(HttpExchange ex) {
        try {
            byte[] bytes = INTERNAL_ERROR_BODY.getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            ex.sendResponseHeaders(500, bytes.length);
            try (OutputStream os = ex.getResponseBody()) {
                os.write(bytes);
            }
        } catch (Throwable ignored) {
            // connection may already be broken — nothing more we can do
        }
    }

    // ---------------- logging ----------------

    static void log(String line) {
        System.err.println(line);
    }

    static void logRequest(String method, String path, int status, Throwable t) {
        StringBuilder sb = new StringBuilder()
            .append("REQ   ").append(method).append(' ').append(path)
            .append(" -> ").append(status);
        if (t != null) {
            sb.append(" exception=").append(t.getClass().getName())
              .append(" message=").append(String.valueOf(t.getMessage()));
            StringWriter sw = new StringWriter();
            t.printStackTrace(new PrintWriter(sw));
            sb.append('\n').append(sw);
        }
        log(sb.toString());
    }

    // ---------------- crypto helpers ----------------

    static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) return false;
        byte[] x = a.getBytes(StandardCharsets.UTF_8);
        byte[] y = b.getBytes(StandardCharsets.UTF_8);
        if (x.length != y.length) return false;
        int r = 0;
        for (int i = 0; i < x.length; i++) r |= x[i] ^ y[i];
        return r == 0;
    }
}
