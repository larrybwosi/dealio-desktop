'use client';

import React from 'react';

import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';
import type { Order, ReceiptConfig } from '@/store/store';

Font.register({
  family: 'Roboto',
  fonts: [
    { src: '/fonts/Roboto-Regular.ttf' },
    { src: '/fonts/Roboto-Bold.ttf', fontWeight: 'bold' },
    { src: '/fonts/Roboto-Italic.ttf', fontStyle: 'italic' }
  ]
});

Font.register({
  family: 'CourierPrime',
  fonts: [
    { src: '/fonts/CourierPrime-Regular.ttf' },
    { src: '/fonts/CourierPrime-Bold.ttf', fontWeight: 'bold' }
  ]
});

interface ReceiptPdfProps {
  order: Order;
  settings: {
    businessName: string;
    businessSlogan?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    currency: string;
    receiptConfig: ReceiptConfig;
    [key: string]: any;
  };
  qrCodeUrl?: string;
  branchName?: string;
}

// --- 3. HELPER FUNCTIONS ---
const formatCurrency = (amount: number, _currency: string) => {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// --- 4. COMPONENT ---
export const ReceiptPdfDocument = ({ order, settings, qrCodeUrl, branchName }: ReceiptPdfProps) => {
  const config = settings.receiptConfig || {};
  
  // PDF Defaults to 80mm thermal if not specified, or A4 if specified
  const isThermal = config.paperSize === '58mm' || config.paperSize === '80mm';
  const baseFontSize = config.fontSize === 'small' ? 9 : config.fontSize === 'medium' ? 10 : 11;

  // --- STYLES ---
  const styles = React.useMemo(() => StyleSheet.create({
    page: {
      fontFamily: 'Roboto',
      fontSize: baseFontSize,
      padding: isThermal ? 12 : 40,
      backgroundColor: '#ffffff',
      color: '#000000',
    },
    // Utilities
    bold: { fontWeight: 'bold' },
    italic: { fontStyle: 'italic' },
    center: { textAlign: 'center' },
    
    // Header Section
    headerContainer: {
      alignItems: 'center',
      marginBottom: 10,
    },
    logo: {
      width: isThermal ? 50 : 60,
      height: isThermal ? 50 : 60,
      objectFit: 'contain',
      marginBottom: 8,
    },
    businessName: {
      fontSize: baseFontSize + 6,
      fontWeight: 'bold',
      marginBottom: 4,
      textAlign: 'center',
    },
    slogan: {
      fontSize: baseFontSize,
      marginBottom: 6,
      textAlign: 'center',
      color: '#000',
    },
    contactInfo: {
      fontSize: baseFontSize - 1,
      color: '#222',
      textAlign: 'center',
      marginBottom: 1,
      lineHeight: 1.3,
    },

    // Receipt Title Section
    receiptTitleBlock: {
      marginTop: 10,
      marginBottom: 10,
      alignItems: 'center',
    },
    receiptTitle: {
      fontSize: baseFontSize + 2,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },

    // Meta Data (Order ID, Date)
    metaContainer: {
      marginBottom: 2,
    },
    metaText: {
      fontSize: baseFontSize,
      marginBottom: 2,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    metaColLeft: {
      textAlign: 'left',
    },
    metaColRight: {
      textAlign: 'right',
    },

    // Section Headers (ITEMS, PAYMENT)
    sectionHeader: {
      fontSize: baseFontSize,
      fontWeight: 'bold',
      marginTop: 8,
      marginBottom: 6,
      textTransform: 'uppercase',
    },

    // Table
    tableContainer: {
      marginBottom: 10,
    },
    tableHeader: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#000',
      paddingBottom: 4,
      marginBottom: 4,
    },
    tableRow: {
      flexDirection: 'row',
      marginBottom: config.itemSpacing !== undefined ? config.itemSpacing : 6,
    },
    // Column Widths
    colItem: { width: '55%' },
    colQty: { width: '15%', textAlign: 'center' },
    colTotal: { width: '30%', textAlign: 'right' },
    
    // Item Details
    itemName: {
      fontSize: baseFontSize,
    },
    itemVariant: {
      fontSize: baseFontSize - 1,
      color: '#444',
      marginTop: 1,
      fontStyle: 'italic',
    },

    // Totals Section
    totalsContainer: {
      marginTop: 4,
      borderTopWidth: 1,
      borderTopColor: '#000',
      borderTopStyle: 'dashed',
      paddingTop: 8,
      alignItems: 'flex-end',
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: isThermal ? '100%' : '60%',
      marginBottom: 2,
    },
    totalLabel: {
      fontSize: baseFontSize,
    },
    totalValue: {
      fontSize: baseFontSize,
      fontWeight: 'bold',
    },
    grandTotalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: isThermal ? '100%' : '60%',
      marginTop: 6,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: '#000',
      borderBottomWidth: 1,
      borderBottomColor: '#000',
      paddingBottom: 2,
    },
    grandTotalText: {
      fontSize: baseFontSize + 2,
      fontWeight: 'bold',
    },

    // Payment Section
    paymentContainer: {
      marginTop: 2,
    },
    paymentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 2,
    },

    // Footer
    footerContainer: {
      marginTop: 20,
      alignItems: 'center',
    },
    footerMessage: {
      fontSize: baseFontSize,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 4,
    },
    footerContact: {
      fontSize: baseFontSize - 1,
      textAlign: 'center',
      marginBottom: 8,
    },
    footerKeepRecord: {
      fontSize: baseFontSize - 1,
      textAlign: 'center',
      marginTop: 8,
      fontStyle: 'italic',
    }
  }), [baseFontSize, isThermal]);

  // --- DYNAMIC HEIGHT CALCULATION ---
  const calculatePageHeight = () => {
    if (config.paperSize === 'Letter') return 'A4';
    
    // Base padding (vertical)
    let height = isThermal ? 24 : 80;

    // Header approximation
    if (config.showLogo && config.logoUrl) height += isThermal ? 60 : 70;
    height += 30; // Business name
    if (config.showTagline || settings.businessSlogan) height += 20;
    
    // Contact info (approx 12px per line)
    const contactLines = [
      config.showAddress && settings.address,
      (config.showPhone || settings.phone),
      settings.email,
      settings.website,
      config.showTaxNumber && config.taxNumber,
      config.showVatNumber && config.vatNumber,
      config.showCompanyRegNumber && config.companyRegNumber
    ].filter(Boolean).length;
    height += contactLines * 12 + 10;

    // Title & Meta
    height += 100; // Receipt Title + Meta block
    if (config.showCustomerName && order.customerName) height += 12;
    if (config.showOrderType && order.orderType) height += 12;
    if (config.showCashier && order.cashierName) height += 12;

    // Items
    height += 30; // Table header
    order.items?.forEach(item => {
      height += 18; // Base item line
      if (item.variantName && !['Default', 'Default Variant'].includes(item.variantName)) height += 12; // Variant line
    });
    height += 20; // Table bottom margin

    // Totals
    if (config.showSubtotal !== false) height += 15;
    if (config.showDiscountBreakdown !== false && order.discount > 0) height += 15;
    if (config.showTaxBreakdown !== false) height += 15;
    if (config.showSavingsTotal && order.discount > 0) height += 15;
    height += 25; // Grand total + margins

    // Payment
    height += 40; 

    // Footer
    height += 60; // Base footer margin + message
    if (config.showNextVisitPromo) height += 20;
    if (config.showLoyaltyPoints || config.showLoyaltyBalance) height += 25;
    if (settings.email) height += 15;
    if (config.showReturnPolicy) height += 25;
    if (config.showLegalDisclaimer) height += 25;
    if (config.showQrCode && qrCodeUrl) height += 60;
    if (config.showSurveyQr) height += 20;
    if (config.showSocialMedia) height += 20;
    
    // Buffer for safety
    return height + 50; 
  };

  const pageSize =
    config.paperSize === '58mm' ? { width: 164, height: calculatePageHeight() } :
    config.paperSize === '80mm' ? { width: 226, height: calculatePageHeight() } :
    'A4';

  // Fallback for null currency
  const currency = settings.currency || 'KSH';

  return (
    <Document>
      <Page size={pageSize} style={styles.page}>
        
        {/* === HEADER === */}
        <View style={styles.headerContainer}>
          {config.showLogo && config.logoUrl && (
            <Image src={config.logoUrl} style={styles.logo} />
          )}
          <Text style={styles.businessName}>{settings.businessName || 'Cake Panier'}</Text>
          {config.showTagline && config.tagline && (
            <Text style={[styles.contactInfo, { fontStyle: 'italic' }]}>{config.tagline}</Text>
          )}
          {settings.businessSlogan && (
             <Text style={styles.slogan}>{settings.businessSlogan}</Text>
          )}
          
          {config.showAddress && settings.address && (
            <Text style={styles.contactInfo}>{settings.address}</Text>
          )}
          {(config.showPhone || settings.phone) && (
            <Text style={styles.contactInfo}>Tel: {settings.phone}</Text>
          )}
          {(settings.email) && (
            <Text style={styles.contactInfo}>Email: {settings.email}</Text>
          )}
          {(settings.website) && (
            <Text style={styles.contactInfo}>{settings.website}</Text>
          )}
          {config.showTaxNumber && config.taxNumber && (
            <Text style={styles.contactInfo}>Tax ID: {config.taxNumber}</Text>
          )}
          {config.showVatNumber && config.vatNumber && (
            <Text style={styles.contactInfo}>VAT: {config.vatNumber}</Text>
          )}
          {config.showCompanyRegNumber && config.companyRegNumber && (
            <Text style={styles.contactInfo}>Reg: {config.companyRegNumber}</Text>
          )}
        </View>



        {/* === META (Order & Date - 2 Columns) === */}
        <View style={styles.metaContainer}>
           {/* Row 1: Time | Branch */}
           <View style={styles.metaRow}>
              <Text style={[styles.metaText, styles.metaColLeft]}>
                {order.createdAt ? format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm') : format(new Date(), 'dd/MM/yyyy HH:mm')}
              </Text>
              {branchName && (
                <Text style={[styles.metaText, styles.metaColRight]}>{branchName}</Text>
              )}
           </View>
           
           {/* Row 2: Served By | Customer */}
           <View style={styles.metaRow}>
              {config.showCashier && order.cashierName ? (
                 <Text style={[styles.metaText, styles.metaColLeft]}>Served by: {order.cashierName}</Text>
              ) : (
                 <Text style={[styles.metaText, styles.metaColLeft]}></Text> 
              )}
              
              {config.showCustomerName && order.customerName && (
                 <Text style={[styles.metaText, styles.metaColRight]}>Customer: {order.customerName}</Text>
              )}
           </View>

           {config.showOrderNumber !== false && (
             <View style={styles.metaRow}>
               <Text style={styles.metaText}>Order: {order.orderNumber}</Text>
             </View>
           )}
        </View>

        {/* === ITEMS === */}
        <View style={styles.tableContainer}>
          <Text style={styles.sectionHeader}>ITEMS</Text>
          
          <View style={styles.tableHeader}>
            <Text style={[styles.colItem, styles.bold]}>Item</Text>
            <Text style={[styles.colQty, styles.bold]}>Qty</Text>
            <Text style={[styles.colTotal, styles.bold]}>Total ({currency})</Text>
          </View>

          {order.items?.map((item, i) => {
            const unitPrice = item.selectedUnit?.price || 0;
            const lineTotal = unitPrice * item.quantity;
            
            // Logic to determine if variant should be shown
            const variantName = item.variantName || '';
            const shouldShowVariant = variantName && !['Default', 'Default Variant'].includes(variantName);

            return (
              <View key={i} style={styles.tableRow}>
                <View style={styles.colItem}>
                  {/* Product Name */}
                  <Text style={styles.itemName}>{item.productName}</Text>
                  
                  {/* Variant Name - displayed below in italics if not default */}
                  {shouldShowVariant && (
                    <Text style={styles.itemVariant}>{variantName}</Text>
                  )}
                </View>
                
                <Text style={styles.colQty}>{item.quantity}</Text>
                <Text style={styles.colTotal}>
                  {formatCurrency(lineTotal, currency)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* === TOTALS === */}
        <View style={styles.totalsContainer}>
          {config.showSubtotal !== false && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(order.subTotal || 0, currency)}
              </Text>
            </View>
          )}
          
          {config.showDiscountBreakdown !== false && order.discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount:</Text>
              <Text style={styles.totalValue}>
                -{formatCurrency(order.discount, currency)}
              </Text>
            </View>
          )}
          
          {config.showTaxBreakdown !== false && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax:</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(order.taxes || 0, currency)}
              </Text>
            </View>
          )}

          {config.showSavingsTotal && order.discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: '#16a34a' }]}>You Saved:</Text>
              <Text style={[styles.totalValue, { color: '#16a34a' }]}>
                {formatCurrency(order.discount, currency)}
              </Text>
            </View>
          )}

          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalText}>TOTAL:</Text>
            <Text style={styles.grandTotalText}>
              {formatCurrency(order.total || 0, currency)}
            </Text>
          </View>
        </View>

        {/* === PAYMENT === */}
        <View style={styles.paymentContainer}>
           <View style={styles.totalRow}>
             <Text style={styles.totalLabel}>Payment:</Text>
             <Text style={styles.totalValue}>{order.paymentMethod || 'Cash'}</Text>
           </View>
        </View>

        {/* === FOOTER === */}
        <View style={styles.footerContainer}>
          {config.showThankYouMessage && config.thankYouMessage ? (
            <Text style={styles.footerMessage}>{config.thankYouMessage}</Text>
          ) : (
            <Text style={styles.footerMessage}>Thank you for your business!</Text>
          )}

          {config.showNextVisitPromo && config.nextVisitPromoText && (
            <Text style={[styles.footerContact, { marginTop: 4 }]}>
              🎁 {config.nextVisitPromoText}
            </Text>
          )}

          {(config.showLoyaltyPoints || config.showLoyaltyBalance) && (
            <View style={{ marginTop: 4 }}>
              {config.showLoyaltyPoints && (
                <Text style={styles.footerContact}>Points Earned: +{Math.floor((order.total || 0) / 10)}</Text>
              )}
              {config.showLoyaltyBalance && (
                <Text style={styles.footerContact}>Loyalty Balance: 150 pts</Text>
              )}
            </View>
          )}
          
          {settings.email && (
            <Text style={styles.footerContact}>Questions? Email: {settings.email}</Text>
          )}

          {config.showReturnPolicy && config.returnPolicyText && (
            <Text style={[styles.footerContact, { marginTop: 4, fontSize: baseFontSize - 2 }]}>
              Return Policy: {config.returnPolicyText}
            </Text>
          )}

          {config.showLegalDisclaimer && config.legalDisclaimerText && (
            <Text style={[styles.footerContact, { marginTop: 4, fontSize: baseFontSize - 2, color: '#888' }]}>
              {config.legalDisclaimerText}
            </Text>
          )}
          
          {config.showQrCode && qrCodeUrl && (
             <Image src={qrCodeUrl} style={{ width: 50, height: 50, marginVertical: 5 }} />
          )}

          {config.showSurveyQr && config.surveyUrl && (
            <Text style={[styles.footerContact, { marginTop: 4 }]}>Rate us: {config.surveyUrl}</Text>
          )}

          {config.showSocialMedia && config.socialMediaHandle && (
            <Text style={[styles.footerContact, { fontWeight: 'bold' }]}>Connect: {config.socialMediaHandle}</Text>
          )}

          <Text style={styles.footerKeepRecord}>Keep this receipt for your records</Text>
        </View>

      </Page>
    </Document>
  );
};