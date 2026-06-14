# ZATCA Signing Service

Minimal Spring Boot microservice that wraps the **official ZATCA Java SDK**
(`sdk-3.0.8`) and exposes a single signing endpoint
for JAAD CLOUD to call.

The Next.js app runs in a Node.js hosting environment, while the official SDK requires a JVM. This service remains the external signing engine selected in `ZATCA_SIGNING_ENGINE=external_sdk`.

---

## Contract

```
POST /sign
Headers:
  Authorization: Bearer {SIGNING_SERVICE_SECRET}
  Content-Type:  application/json
```

**Request body**
```json
{
  "unsignedXml":      "<full UBL XML string, NOT base64>",
  "privateKeyPem":    "-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----",
  "certificatePem":   "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
  "pihBase64":        "<base64 of previous-invoice-hash>",
  "icv":              123,
  "invoiceUuid":      "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response 200**
```json
{
  "signedXmlBase64":           "PD94bWwg...",
  "invoiceHashBase64":         "Bfwdr4n9...=",
  "qrBase64":                  "AQpZZWxsb3c...",
  "signedPropertiesDigestB64": "YmI2ZTQ0...",
  "certDigestB64":             "N2E2NWYw...",
  "signatureValueB64":         "MEUCIQ...",
  "diagnostics": {
    "sdkVersion": "3.0.8",
    "signedPropertiesHashing": "sdk",
    "qrTagCount": 9,
    "icv": 123,
    "invoiceUuid": "550e8400-...",
    "pihBase64Echo": "..."
  }
}
```

`GET /health` returns `{ "status": "ok", "sdkVersion": "..." }` and is the only
unauthenticated route.

---

## Required env vars

| Variable                  | Purpose                                                      |
|---------------------------|--------------------------------------------------------------|
| `SIGNING_SERVICE_SECRET`  | Shared secret. Must match `ZATCA_SIGNING_SERVICE_SECRET` set on the app side. **Required** — service refuses requests if missing. |
| `PORT`                    | Optional. Defaults to `8080`. Cloud Run / Fly set this automatically. |

---

## 1. Get the ZATCA SDK jar

The SDK is **not** on Maven Central — it is licensed and distributed by ZATCA
through the Fatoora developer portal.

1. Sign in: https://sandbox.zatca.gov.sa/ → Fatoora Portal → SDK downloads.
2. Download `sdk-3.0.8.zip`.
3. Extract and copy the jar:

```bash
mkdir -p libs
cp /path/to/sdk-3.0.8/Apps/sdk-3.0.8-jar-with-dependencies.jar libs/
```

The Dockerfile fails fast with a clear error if this jar is missing.

> If your downloaded jar lives under a different package path or uses
> different class/method names, edit the constants at the top of
> `src/main/java/com/yellowchicken/zatca/ZatcaSdkAdapter.java` — the adapter
> uses reflection so a small SDK rename does not break the build, only runtime.

---

## 2. Build & run locally (no Docker)

```bash
cd zatca-signing-service
export SIGNING_SERVICE_SECRET="dev-secret-change-me"
mvn -B -DskipTests package
java -jar target/zatca-signing-service-0.1.0.jar
```

Service listens on `http://localhost:8080`.

### Sample curl

```bash
curl -s http://localhost:8080/health

curl -s -X POST http://localhost:8080/sign \
  -H "Authorization: Bearer $SIGNING_SERVICE_SECRET" \
  -H "Content-Type: application/json" \
  -d @sample-request.json | jq .
```

Where `sample-request.json` matches the contract above.

---

## 3. Build & run with Docker

```bash
cd zatca-signing-service
# libs/sdk-3.0.8-jar-with-dependencies.jar must already be in place
docker build -t zatca-signing-service:0.1.0 .

docker run --rm -p 8080:8080 \
  -e SIGNING_SERVICE_SECRET="dev-secret-change-me" \
  zatca-signing-service:0.1.0
```

---

## 4. Deploy

### Google Cloud Run (recommended — simplest)

```bash
# One-time
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT
gcloud auth configure-docker REGION-docker.pkg.dev

# Build & push (replace REGION e.g. europe-west1)
docker build --platform linux/amd64 -t REGION-docker.pkg.dev/YOUR_GCP_PROJECT/zatca/signing:0.1.0 .
docker push       REGION-docker.pkg.dev/YOUR_GCP_PROJECT/zatca/signing:0.1.0

# Create secret
echo -n "$(openssl rand -hex 32)" | gcloud secrets create zatca-signing-secret --data-file=-

# Deploy
gcloud run deploy zatca-signing \
  --image REGION-docker.pkg.dev/YOUR_GCP_PROJECT/zatca/signing:0.1.0 \
  --region REGION \
  --platform managed \
  --no-allow-unauthenticated \
  --memory 512Mi --cpu 1 \
  --set-secrets SIGNING_SERVICE_SECRET=zatca-signing-secret:latest
```

Then grant the app side an invoker credential (or set `--allow-unauthenticated`
**only if** you rely on the bearer token; both layers of auth is safer).

Give the deployed URL + the secret value to the app side as:
- `ZATCA_SIGNING_SERVICE_URL`   (e.g. `https://zatca-signing-xxxx.a.run.app`)
- `ZATCA_SIGNING_SERVICE_SECRET`

### Fly.io

```bash
fly launch --no-deploy --name zatca-signing
fly secrets set SIGNING_SERVICE_SECRET="$(openssl rand -hex 32)"
fly deploy
```

`fly.toml` should expose port `8080` (internal_port = 8080).

### Plain VPS (Docker Compose)

```yaml
# docker-compose.yml
services:
  zatca-signing:
    build: ./zatca-signing-service
    restart: unless-stopped
    ports: ["127.0.0.1:8080:8080"]
    environment:
      - SIGNING_SERVICE_SECRET=${SIGNING_SERVICE_SECRET}
```

Front with nginx + TLS (Let's Encrypt) — the app should only call this service over HTTPS.

---

## 5. Security notes

- **HTTPS only.** Never deploy this on plain HTTP. The request contains the
  full PEM private key for the ZATCA CSID.
- **Rotate `SIGNING_SERVICE_SECRET`** if you ever suspect leakage. The app side reads it at request time, so rotation is just: update the secret in the
  service + update `ZATCA_SIGNING_SERVICE_SECRET` in the hosting environment.
- **Do not log request bodies.** The default config disables Spring's
  `log-request-details`. Keep it that way.
- **Network scope.** If your hosting allows it, restrict ingress to the
  Cloudflare egress range or use a Cloud Run "invoker" IAM binding.

---

## 6. Rollback path

The app keeps the legacy in-process signer behind a feature flag:

```
ZATCA_SIGNING_ENGINE=legacy        # old in-process JS signer
ZATCA_SIGNING_ENGINE=external_sdk  # this service
```

Flip the env var to roll back without redeploying either side.
