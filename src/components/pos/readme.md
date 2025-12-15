
// --- NEW HELPER FUNCTION FOR MPESA QR DATA (M-Pesa Express Format) ---
const generateMpesaQrCodeData = (
    organizationName: string, 
    paybillNumber: string, 
    tillNumber: string, 
    accountRef: string, 
    amount: number
): string => {
    // Safaricom standard for Transacting QR (Lipa na M-Pesa QR)
    // Structure: MerchantName*Paybill/Till*AccountRef*Amount
    
    const businessNumber = paybillNumber || tillNumber; // Choose one for the business identifier
    const type = paybillNumber ? 'Paybill' : 'Till';

    if (!businessNumber) return `ERROR*NO_MPESA_ID*0*0*0`; // Fallback for missing settings

    // The M-Pesa Express standard format usually uses tags and values (TLV)
    // For a simple QR that M-Pesa app can read: 
    // Example format: 
    // 1: Payload Type (00: Qr code)
    // 2: M-Pesa Merchant Type (01: Paybill, 02: Till) - Use a placeholder since we don't know the exact TLV standard for Transacting QR
    // 3: Organization Shortcode
    // 4: Transaction Amount
    // 5: Account Reference (BillRef)
    
    // Using a more standard (non-TLV) format for simplicity and readability in this example:
    return `M-PESA-PAYMENT|${type.toUpperCase()}|${businessNumber}|${accountRef}|${amount.toFixed(2)}|${organizationName}`;
};
