package com.yellowchicken.zatca;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.security.Security;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Adapter over the official ZATCA Java SDK fat-jar.
 *
 * v0.1.12 — Surgical diagnostic patch. SDK 4.0.0 reflection discovery (0.1.11)
 * proved there is NO File/Path-based signDocument overload. The real public
 * contract is:
 *
 *     SigningServiceImpl#signDocument(String xml,
 *                                     InputStream privateKeyStream,
 *                                     InputStream certificateStream,
 *                                     String pih)
 *
 * This version invokes that overload directly with the cleaned UTF-8 XML
 * string and PEM byte streams, and surfaces safe prolog byte diagnostics
 * (first 32 bytes hex + first 32 visible chars, on both raw input and
 * cleaned XML) so we can finally see whether an invisible byte ahead of
 * "<?xml" is what's tripping the SDK's internal Saxon hasher.
 *
 * Never logs / returns: raw XML, privateKeyPem, certificatePem, signedXml,
 * bearer tokens, or any Authorization header.
 */
public class ZatcaSdkAdapter {

    public static final String SDK_VERSION =
        System.getenv().getOrDefault("ZATCA_SDK_VERSION", "unknown");

    private static final String CLS_SIGNING_SERVICE_IMPL =
        "com.gazt.einvoicing.signing.service.impl.SigningServiceImpl";

    private static final String[] DIAG_CLASS_CANDIDATES = new String[] {
        CLS_SIGNING_SERVICE_IMPL,
        "com.gazt.einvoicing.signing.service.SigningService",
        "com.gazt.einvoicing.hashing.service.impl.InvoiceHashingServiceImpl",
        "com.gazt.einvoicing.hashing.service.InvoiceHashingService",
        "com.gazt.einvoicing.qrcode.service.impl.QRCodeGenerationServiceImpl",
        "com.gazt.einvoicing.qrcode.service.QRCodeGenerationService"
    };

    private static final String[] METHOD_NAME_HINTS = new String[] {
        "sign", "hash", "generate", "invoice", "qr"
    };

    private static final String SDK_OVERLOAD_USED =
        "signDocument(String, InputStream, InputStream, String)";

    static {
        try {
            Class<?> bc = Class.forName("org.bouncycastle.jce.provider.BouncyCastleProvider");
            if (Security.getProvider("BC") == null) {
                Security.addProvider((java.security.Provider) bc.getDeclaredConstructor().newInstance());
            }
        } catch (Throwable ignored) { /* SDK may not need BC; ignore */ }
    }

    public static class UnsignedXmlNormalizationException extends Exception {
        public final String code;
        public final Map<String, Object> diagnostics;
        public UnsignedXmlNormalizationException(String code, String message,
                                                 Map<String, Object> diagnostics) {
            super(message);
            this.code = code;
            this.diagnostics = diagnostics;
        }
    }

    /** Carries safe diagnostics for any SDK-side failure. Never any key/XML material. */
    public static class SdkSigningDiagnosticsException extends Exception {
        public final String stage;
        public final String errorClass;
        public final List<Map<String, Object>> availableSignatures;
        public final Map<String, Object> prologDiagnostics;
        public SdkSigningDiagnosticsException(String stage, String errorClass, String message,
                                              List<Map<String, Object>> availableSignatures,
                                              Map<String, Object> prologDiagnostics,
                                              Throwable cause) {
            super(message, cause);
            this.stage = stage;
            this.errorClass = errorClass;
            this.availableSignatures = availableSignatures;
            this.prologDiagnostics = prologDiagnostics;
        }
    }

    public SignResponse signInvoice(SignRequest req) throws Exception {
        // 1) Always compute discovery + prolog diagnostics first, so they are
        //    available on every failure path.
        List<Map<String, Object>> signatures = discoverSdkSignatures();

        NormalizedXml norm = normalizeUnsignedXml(req.unsignedXml);
        Map<String, Object> prolog = norm.diagnostics;
        prolog.put("sdkOverloadUsed", SDK_OVERLOAD_USED);

        // 2) Locate the InputStream overload explicitly. No path/File guessing.
        Method m = findInputStreamOverload();
        if (m == null) {
            throw new SdkSigningDiagnosticsException(
                "sdk_overload_lookup",
                "NoMatchingSdkMethod",
                "Required overload not found on SDK " + SDK_VERSION + ": " + SDK_OVERLOAD_USED,
                signatures,
                prolog,
                null
            );
        }

        // 3) Invoke. Cleaned XML string + properly-formatted PEM byte streams + PIH (4th String arg).
        //    Private key: SDK's internal Base64.decode wants the raw DER base64 body only
        //      (no -----BEGIN/END----- headers, no newlines). 0.1.13's full-PEM base64
        //      wrap base64-decoded back to PEM text and tripped BouncyCastle ASN.1
        //      ("unknown tag 13 encountered" = 0x0D / CR).
        //    Certificate: keep current behavior — base64 of full PEM (matches ZATCA csid.token).
        String pkBody = extractPemBase64Body(req.privateKeyPem);
        byte[] keyBytes  = pkBody.getBytes(StandardCharsets.US_ASCII);
        byte[] certBytes = Base64.getEncoder().encode(
            req.certificatePem.getBytes(StandardCharsets.UTF_8));

        prolog.put("privateKeyStreamFormat", "der_base64_body");
        prolog.put("certificateStreamFormat", "base64_of_full_pem");
        prolog.put("privateKeyPemHeaderPresent", firstPemHeader(req.privateKeyPem) != null);
        prolog.put("privateKeyBodyLength", pkBody.length());
        prolog.put("certificatePemHeader", firstPemHeader(req.certificatePem));



        Object result;
        try (InputStream keyIs  = new ByteArrayInputStream(keyBytes);
             InputStream certIs = new ByteArrayInputStream(certBytes)) {
            Class<?> svcCls = m.getDeclaringClass();
            Object svc = svcCls.getDeclaredConstructor().newInstance();
            try {
                result = m.invoke(svc, norm.cleanedXml, keyIs, certIs, req.pihBase64);
            } catch (java.lang.reflect.InvocationTargetException ite) {
                Throwable cause = ite.getCause() != null ? ite.getCause() : ite;
                throw new SdkSigningDiagnosticsException(
                    "sdk_signDocument_invoke",
                    cause.getClass().getSimpleName(),
                    String.valueOf(cause.getMessage()),
                    signatures,
                    prolog,
                    cause
                );
            } catch (Throwable t) {
                throw new SdkSigningDiagnosticsException(
                    "sdk_signDocument_invoke",
                    t.getClass().getSimpleName(),
                    String.valueOf(t.getMessage()),
                    signatures,
                    prolog,
                    t
                );
            }
        }

        if (result == null) {
            throw new SdkSigningDiagnosticsException(
                "sdk_signDocument_invoke",
                "NullResult",
                "SDK signDocument returned null",
                signatures,
                prolog,
                null
            );
        }

        String signedXml      = (String) safeCall(result, "getSingedXML"); // sic
        if (signedXml == null) signedXml = (String) safeCall(result, "getSignedXML");
        String invoiceHashB64 = (String) safeCall(result, "getInvoiceHash");
        String qrBase64       = (String) safeCall(result, "getQrCode");

        // ── KSA-25 timestamp post-fix ─────────────────────────────────────
        // SDK 4.0.0 emits xades:SigningTime and QR Tag 3 without the trailing
        // "Z". ZATCA treats both as local time and raises KSA-25 against
        // cbc:IssueDate/IssueTime (Asia/Riyadh = UTC+3). Append "Z" where
        // missing. See TimestampPostProcessor for signature-integrity caveats.
        TimestampPostProcessor.Result tsFix =
            TimestampPostProcessor.apply(signedXml, qrBase64);
        signedXml = tsFix.signedXml;
        qrBase64  = tsFix.qrBase64;

        String signedPropsB64  = signedXml != null ? extractSignedPropertiesDigest(signedXml) : null;
        String certDigestB64   = signedXml != null ? extractCertDigest(signedXml) : null;
        String signatureValB64 = signedXml != null ? extractSignatureValue(signedXml) : null;

        SignResponse out = new SignResponse();
        if (signedXml != null) {
            out.signedXmlBase64 = Base64.getEncoder().encodeToString(
                signedXml.getBytes(StandardCharsets.UTF_8));
        }
        out.invoiceHashBase64         = invoiceHashB64;
        out.qrBase64                  = qrBase64;
        out.signedPropertiesDigestB64 = signedPropsB64;
        out.certDigestB64             = certDigestB64;
        out.signatureValueB64         = signatureValB64;

        Map<String, Object> diag = new LinkedHashMap<>();
        diag.put("engine", "zatca-java-sdk");
        diag.put("sdkJar", "sdk-" + SDK_VERSION + "-jar-with-dependencies.jar");
        diag.put("sdkVersion", SDK_VERSION);
        diag.put("signingClass", m.getDeclaringClass().getName());
        diag.put("signingMethod", describeMethod(m));
        diag.put("icv", req.icv);
        diag.put("invoiceUuid", req.invoiceUuid);
        diag.putAll(prolog);
        diag.put("availableSignatures", signatures);
        diag.put("timestampFix", tsFix.asDiagnosticsMap());
        out.diagnostics = diag;
        return out;
    }

    // ---------------- SDK overload lookup ----------------

    private Method findInputStreamOverload() {
        for (String cn : new String[] {
            CLS_SIGNING_SERVICE_IMPL,
            "com.gazt.einvoicing.signing.service.SigningService"
        }) {
            Class<?> cls;
            try { cls = Class.forName(cn); } catch (Throwable t) { continue; }
            for (Method m : cls.getMethods()) {
                if (!"signDocument".equals(m.getName())) continue;
                Class<?>[] p = m.getParameterTypes();
                if (p.length != 4) continue;
                if (p[0] == String.class
                    && InputStream.class.isAssignableFrom(p[1])
                    && InputStream.class.isAssignableFrom(p[2])
                    && p[3] == String.class) {
                    return m;
                }
            }
        }
        return null;
    }

    private List<Map<String, Object>> discoverSdkSignatures() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (String cn : DIAG_CLASS_CANDIDATES) {
            Class<?> cls;
            try { cls = Class.forName(cn); } catch (Throwable t) { continue; }
            for (Method m : cls.getMethods()) {
                String lname = m.getName().toLowerCase(Locale.ROOT);
                boolean matches = false;
                for (String hint : METHOD_NAME_HINTS) {
                    if (lname.contains(hint)) { matches = true; break; }
                }
                if (!matches) continue;
                Map<String, Object> sig = new LinkedHashMap<>();
                sig.put("className", cls.getName());
                sig.put("methodName", m.getName());
                sig.put("parameterTypes", paramNames(m.getParameterTypes()));
                sig.put("returnType", m.getReturnType().getName());
                sig.put("modifiers", Modifier.toString(m.getModifiers()));
                out.add(sig);
            }
        }
        return out;
    }

    private static List<String> paramNames(Class<?>[] params) {
        List<String> names = new ArrayList<>(params.length);
        for (Class<?> c : params) names.add(c.getName());
        return names;
    }

    private static String describeMethod(Method m) {
        return m.getDeclaringClass().getName() + "#" + m.getName()
            + "(" + String.join(",", paramNames(m.getParameterTypes())) + ")";
    }

    // ---------------- normalization + prolog diagnostics ----------------

    private static final class NormalizedXml {
        final String cleanedXml;
        final Map<String, Object> diagnostics;
        NormalizedXml(String cleanedXml, Map<String, Object> diagnostics) {
            this.cleanedXml = cleanedXml;
            this.diagnostics = diagnostics;
        }
    }

    /**
     * Cleanup contract (matches user spec):
     *   - strip BOM if present
     *   - strip leading whitespace before first "<"
     *   - verify cleaned XML starts with "<"
     *   - do not modify content beyond that
     *
     * Returns prolog diagnostics covering both the raw input bytes and the
     * cleaned bytes — never includes the full XML.
     */
    private static NormalizedXml normalizeUnsignedXml(String input)
            throws UnsignedXmlNormalizationException {
        Map<String, Object> diag = new LinkedHashMap<>();
        if (input == null || input.isEmpty()) {
            diag.put("unsignedXmlFirst32BytesHex", "");
            diag.put("unsignedXmlFirst32CharsVisible", "");
            diag.put("cleanedXmlFirst32BytesHex", "");
            diag.put("cleanedXmlFirst32CharsVisible", "");
            diag.put("cleanedXmlStartsWith", "");
            diag.put("removedBom", false);
            diag.put("removedLeadingWhitespace", false);
            throw new UnsignedXmlNormalizationException(
                "decoded_unsigned_xml_not_xml", "unsignedXml is empty", diag);
        }

        byte[] rawBytes = input.getBytes(StandardCharsets.UTF_8);
        diag.put("unsignedXmlFirst32BytesHex", hexPrefix(rawBytes, 32));
        diag.put("unsignedXmlFirst32CharsVisible", visiblePrefix(input, 32));

        // Strip BOM (UTF-8 EF BB BF, represented as char \uFEFF when decoded).
        boolean removedBom = false;
        String s = input;
        if (s.length() > 0 && s.charAt(0) == '\uFEFF') {
            s = s.substring(1);
            removedBom = true;
        }

        // Strip leading whitespace before first '<'.
        boolean removedLeadingWhitespace = false;
        int k = 0;
        while (k < s.length() && Character.isWhitespace(s.charAt(k))) k++;
        if (k > 0) {
            s = s.substring(k);
            removedLeadingWhitespace = true;
        }

        byte[] cleanedBytes = s.getBytes(StandardCharsets.UTF_8);
        diag.put("cleanedXmlFirst32BytesHex", hexPrefix(cleanedBytes, 32));
        diag.put("cleanedXmlFirst32CharsVisible", visiblePrefix(s, 32));
        diag.put("cleanedXmlStartsWith", s.isEmpty() ? "" : String.valueOf(s.charAt(0)));
        diag.put("removedBom", removedBom);
        diag.put("removedLeadingWhitespace", removedLeadingWhitespace);

        if (s.isEmpty() || s.charAt(0) != '<') {
            throw new UnsignedXmlNormalizationException(
                "decoded_unsigned_xml_not_xml",
                "cleaned unsignedXml does not start with '<'",
                diag);
        }

        return new NormalizedXml(s, diag);
    }

    private static String hexPrefix(byte[] bytes, int n) {
        int len = Math.min(n, bytes.length);
        StringBuilder sb = new StringBuilder(len * 2);
        for (int i = 0; i < len; i++) {
            sb.append(String.format("%02x", bytes[i] & 0xFF));
        }
        return sb.toString();
    }

    /** Replace non-printable / control / high chars with '.', so the preview is log-safe. */
    private static String visiblePrefix(String s, int n) {
        int len = Math.min(n, s.length());
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) {
            char c = s.charAt(i);
            sb.append((c >= 0x20 && c < 0x7F) ? c : '.');
        }
        return sb.toString();
    }

    private static String firstPemHeader(String pem) {
        if (pem == null) return null;
        int start = 0;
        int len = pem.length();
        while (start < len && Character.isWhitespace(pem.charAt(start))) start++;
        int end = pem.indexOf('\n', start);
        if (end < 0) end = len;
        String line = pem.substring(start, end).trim();
        return line.startsWith("-----BEGIN") ? line : null;
    }

    /**
     * Strip PEM armor (-----BEGIN/END ... -----) and all whitespace, returning
     * only the raw base64 body. If no PEM headers are present, just strips
     * whitespace from the input.
     */
    private static String extractPemBase64Body(String pem) {
        if (pem == null) return "";
        String s = pem.replaceAll("-----BEGIN[^-]*-----", "")
                      .replaceAll("-----END[^-]*-----", "");
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (!Character.isWhitespace(c)) sb.append(c);
        }
        return sb.toString();
    }


    private static Object safeCall(Object target, String method) {

        try {
            Method m = target.getClass().getMethod(method);
            return m.invoke(target);
        } catch (Throwable t) {
            return null;
        }
    }

    // ---------------- safe regex extraction from signed XML ----------------

    private static final Pattern SIGNATURE_VALUE =
        Pattern.compile("<(?:[\\w-]+:)?SignatureValue[^>]*>([^<]+)</(?:[\\w-]+:)?SignatureValue>",
            Pattern.DOTALL);
    private static final Pattern SIGNED_PROPS_REF =
        Pattern.compile("<(?:[\\w-]+:)?Reference[^>]*URI=\"#xadesSignedProperties\"[\\s\\S]*?" +
                        "<(?:[\\w-]+:)?DigestValue[^>]*>([^<]+)</(?:[\\w-]+:)?DigestValue>",
                        Pattern.DOTALL);
    private static final Pattern CERT_DIGEST =
        Pattern.compile("<(?:[\\w-]+:)?CertDigest[\\s\\S]*?" +
                        "<(?:[\\w-]+:)?DigestValue[^>]*>([^<]+)</(?:[\\w-]+:)?DigestValue>",
                        Pattern.DOTALL);

    private static String extractSignatureValue(String xml) { return firstGroup(SIGNATURE_VALUE.matcher(xml)); }
    private static String extractSignedPropertiesDigest(String xml) { return firstGroup(SIGNED_PROPS_REF.matcher(xml)); }
    private static String extractCertDigest(String xml) { return firstGroup(CERT_DIGEST.matcher(xml)); }
    private static String firstGroup(Matcher m) { return m.find() ? m.group(1).trim() : null; }
}
