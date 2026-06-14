package com.yellowchicken.zatca;

/** Plain POJO populated manually from the parsed JSON body. */
public class SignRequest {
    public String unsignedXml;     // base64 OR raw UBL XML — adapter accepts both
    public String privateKeyPem;   // PEM, EC secp256k1
    public String certificatePem;  // PEM, ZATCA-issued CSID cert
    public String pihBase64;       // Previous Invoice Hash (base64)
    public Integer icv;            // Invoice Counter Value
    public String invoiceUuid;     // UUID v4
}
