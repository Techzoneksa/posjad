package com.yellowchicken.zatca;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Surgical post-processor for ZATCA KSA-25 timestamp warning.
 *
 * Root cause confirmed by external_sdk timestamp diagnostic:
 *   - cbc:IssueDate           = YYYY-MM-DD
 *   - cbc:IssueTime           = HH:mm:ss          (UBL xs:time, no Z — correct)
 *   - xades:SigningTime       = YYYY-MM-DDTHH:mm:ss   (missing Z — abnormal)
 *   - QR TLV Tag 3 timestamp  = YYYY-MM-DDTHH:mm:ss   (missing Z — abnormal)
 *
 * What this class does:
 *   1. Parses signedXml safely with regex (no DOM mutation that could
 *      reformat unrelated bytes).
 *   2. If xades:SigningTime matches "YYYY-MM-DDTHH:mm:ss" with no timezone,
 *      appends "Z" to it.
 *   3. Decodes QR base64, walks the TLV, locates Tag 3. If its value matches
 *      "YYYY-MM-DDTHH:mm:ss" with no timezone, appends "Z", recomputes the
 *      Tag 3 length byte, re-encodes the full TLV, and re-base64s the QR.
 *   4. Replaces the cbc:EmbeddedDocumentBinaryObject for the QR
 *      AdditionalDocumentReference in signedXml with the corrected QR.
 *
 * Signature impact:
 *   - QR is OUTSIDE the invoice digest scope: the ZATCA Reference URI=""
 *     uses an XPath transform that excludes
 *       cac:AdditionalDocumentReference[cbc:ID='QR'].
 *     Therefore changing the QR EmbeddedDocumentBinaryObject does NOT
 *     invalidate ds:SignatureValue or InvoiceHash.
 *   - xades:SigningTime is INSIDE xades:SignedProperties, which IS digested
 *     via Reference URI="#xadesSignedProperties" in ds:SignedInfo. Mutating
 *     it would stale the digest and invalidate ds:SignatureValue.
 *     v0.1.16 contract: NEVER modify xades:SigningTime here. We only read it
 *     for diagnostics; signatureIntegrityPreserved stays true.
 *
 * Logging contract: this class returns values but does NOT log XML or keys.
 */
public final class TimestampPostProcessor {

    private TimestampPostProcessor() {}

    public static final class Result {
        public String  signedXml;
        public String  qrBase64;

        public String  signingTimeBefore;
        public String  signingTimeAfter;
        public Boolean signingTimeHadZ;
        public boolean signingTimeModified;

        public String  qrTag3Before;
        public String  qrTag3After;
        public Boolean qrTag3HadZ;
        public boolean qrTag3Modified;

        public boolean signedXmlQrReplaced;
        public boolean signatureIntegrityPreserved = true;

        /** Free-text non-sensitive notes (parse errors, missing elements). */
        public String  notes;

        public Map<String, Object> asDiagnosticsMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("signingTimeBefore", signingTimeBefore);
            m.put("signingTimeAfter", signingTimeAfter);
            m.put("signingTimeHadZ", signingTimeHadZ);
            m.put("signingTimeModified", signingTimeModified);
            m.put("qrTag3Before", qrTag3Before);
            m.put("qrTag3After", qrTag3After);
            m.put("qrTag3HadZ", qrTag3HadZ);
            m.put("qrTag3Modified", qrTag3Modified);
            m.put("signedXmlQrReplaced", signedXmlQrReplaced);
            m.put("signatureIntegrityPreserved", signatureIntegrityPreserved);
            if (notes != null) m.put("notes", notes);
            return m;
        }
    }

    // Permissive namespace prefix; matches xades:SigningTime, sig:SigningTime, etc.
    private static final Pattern SIGNING_TIME = Pattern.compile(
        "(<(?:[\\w-]+:)?SigningTime[^>]*>)([^<]+)(</(?:[\\w-]+:)?SigningTime>)");

    // QR EmbeddedDocumentBinaryObject inside an AdditionalDocumentReference whose
    // ID is "QR". Permissive on attribute order and whitespace.
    private static final Pattern EMBEDDED_QR = Pattern.compile(
        "(<(?:[\\w-]+:)?AdditionalDocumentReference[^>]*>\\s*" +
        "<(?:[\\w-]+:)?ID[^>]*>QR</(?:[\\w-]+:)?ID>" +
        "[\\s\\S]*?" +
        "<(?:[\\w-]+:)?EmbeddedDocumentBinaryObject[^>]*>)" +
        "([^<]+)" +
        "(</(?:[\\w-]+:)?EmbeddedDocumentBinaryObject>)");

    private static final Pattern NAIVE_DT =
        Pattern.compile("^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$");

    private static final Pattern HAS_TZ_SUFFIX =
        Pattern.compile(".*([Zz]|[+-]\\d{2}:?\\d{2})$");

    public static Result apply(String signedXml, String qrBase64) {
        Result r = new Result();
        r.signedXml = signedXml;
        r.qrBase64  = qrBase64;

        // ----- 1) xades:SigningTime — OBSERVE ONLY, never modify.
        // xades:SigningTime lives inside xades:SignedProperties, which is
        // digested by ds:SignedInfo Reference URI="#xadesSignedProperties".
        // Any mutation here would stale the digest and invalidate
        // ds:SignatureValue. v0.1.16 contract: do not touch it.
        if (signedXml != null) {
            Matcher m = SIGNING_TIME.matcher(signedXml);
            if (m.find()) {
                String before = m.group(2).trim();
                r.signingTimeBefore = before;
                r.signingTimeAfter = before; // unchanged
                r.signingTimeHadZ = HAS_TZ_SUFFIX.matcher(before).matches();
            }
        }
        r.signingTimeModified = false;

        // ----- 2) QR TLV Tag 3 -----
        if (qrBase64 != null && !qrBase64.isEmpty()) {
            try {
                byte[] qrBytes = Base64.getDecoder().decode(qrBase64);
                LinkedHashMap<Integer, byte[]> tlv = parseTlv(qrBytes);
                byte[] tag3 = tlv.get(3);
                if (tag3 != null) {
                    String before = new String(tag3, StandardCharsets.UTF_8);
                    r.qrTag3Before = before;
                    boolean hasTz = HAS_TZ_SUFFIX.matcher(before).matches();
                    r.qrTag3HadZ = hasTz;
                    if (!hasTz && NAIVE_DT.matcher(before).matches()) {
                        String after = before + "Z";
                        byte[] afterBytes = after.getBytes(StandardCharsets.UTF_8);
                        if (afterBytes.length > 255) {
                            r.notes = "qr_tag3_too_long_for_single_byte_length";
                        } else {
                            tlv.put(3, afterBytes);
                            byte[] newQr = buildTlv(tlv);
                            String newB64 = Base64.getEncoder().encodeToString(newQr);
                            r.qrBase64 = newB64;
                            r.qrTag3After = after;
                            r.qrTag3Modified = true;
                            // QR is excluded from invoice digest -> safe.

                            // Replace embedded QR in signedXml if present.
                            if (r.signedXml != null) {
                                Matcher mm = EMBEDDED_QR.matcher(r.signedXml);
                                if (mm.find()) {
                                    String replacement =
                                        Matcher.quoteReplacement(mm.group(1))
                                      + Matcher.quoteReplacement(newB64)
                                      + Matcher.quoteReplacement(mm.group(3));
                                    r.signedXml = mm.replaceFirst(replacement);
                                    r.signedXmlQrReplaced = true;
                                }
                            }
                        }
                    } else {
                        r.qrTag3After = before;
                    }
                }
            } catch (Throwable t) {
                String prev = r.notes == null ? "" : r.notes + "; ";
                r.notes = prev + "qr_tlv_parse_or_rebuild_failed:" + t.getClass().getSimpleName();
            }
        }

        return r;
    }

    /**
     * Parse a ZATCA QR TLV. Each entry is tag(1) + length(1, simple form,
     * value &lt; 256) + value. All ZATCA QR tags fit in single-byte length.
     */
    private static LinkedHashMap<Integer, byte[]> parseTlv(byte[] buf) {
        LinkedHashMap<Integer, byte[]> out = new LinkedHashMap<>();
        int i = 0;
        while (i < buf.length) {
            int tag = buf[i++] & 0xFF;
            if (i >= buf.length) break;
            int len = buf[i++] & 0xFF;
            if (i + len > buf.length) break;
            byte[] val = new byte[len];
            System.arraycopy(buf, i, val, 0, len);
            i += len;
            out.put(tag, val);
        }
        return out;
    }

    private static byte[] buildTlv(LinkedHashMap<Integer, byte[]> tlv) {
        int total = 0;
        for (byte[] v : tlv.values()) total += 2 + v.length;
        byte[] out = new byte[total];
        int o = 0;
        for (Map.Entry<Integer, byte[]> e : tlv.entrySet()) {
            out[o++] = (byte) (e.getKey() & 0xFF);
            byte[] v = e.getValue();
            out[o++] = (byte) (v.length & 0xFF);
            System.arraycopy(v, 0, out, o, v.length);
            o += v.length;
        }
        return out;
    }
}
