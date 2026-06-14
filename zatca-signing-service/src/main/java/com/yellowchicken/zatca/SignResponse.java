package com.yellowchicken.zatca;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class SignResponse {
    public String signedXmlBase64;
    public String invoiceHashBase64;
    public String qrBase64;
    public String signedPropertiesDigestB64;
    public String certDigestB64;
    public String signatureValueB64;
    public Map<String, Object> diagnostics;
}
