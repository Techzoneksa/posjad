# JAAD CLOUD Standalone API

This is the standalone Express.js REST API for JAAD CLOUD. It is independent from the Next.js frontend and targets Node.js 22.x on Hostinger.

## Run Locally

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Production:

```bash
npm start
```

## Environment

Required:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `PORT`
- `CORS_ORIGIN`
- `PUBLIC_WEBHOOK_HMAC_SECRET`
- `DATABASE_URL`

## API Shape

- `GET /health`
- `POST /api/rpc/:action`
- `GET /api/rpc/:action`
- `POST /api/public/:provider/:event`

Most RPC actions require:

```http
Authorization: Bearer <supabase-access-token>
```

The public webhook route requires an HMAC signature in `X-JAAD-Signature` or `X-Signature` when `PUBLIC_WEBHOOK_HMAC_SECRET` is configured.

## ZATCA Runtime

Set these variables to enable Phase 2 signing and background submission:

- `ZATCA_SIGNING_SERVICE_URL`
- `ZATCA_SIGNING_SERVICE_SECRET`
- `ZATCA_DEVICE_KEY_ENCRYPTION_SECRET` or `ZATCA_SECRET_KEY`
- `ZATCA_AUTO_RUNNER_ENABLED=true`

The Node API generates UBL XML, Phase 1 TLV QR, PIH/invoice hashes, calls the Java `/sign` service for XAdES-B-B signing, then submits signed invoices to Reporting or Clearance according to the customer VAT context.

Build the signing service from `zatca-signing-service/`:

```bash
docker build -t jaad-zatca-signing:latest ../zatca-signing-service
docker run -p 8081:8080 -e SIGNING_SERVICE_SECRET=replace-with-shared-secret jaad-zatca-signing:latest
```

## Migration Flow

See `server/db/README.md`.
