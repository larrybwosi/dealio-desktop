'use client';

import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';
import type { Order, ReceiptConfig } from '@/store/store';

Font.register({
  family: 'Courier',
  src: 'https://fonts.gstatic.com/s/courierprime/v9/u-450wd2gHbuK602K24.ttf',
});

interface ReceiptPdfProps {
  order: Order;
  settings: any;
  qrCodeUrl?: string;
}

const createStyles = (settings: any) => {
  const config = settings.receiptConfig as ReceiptConfig;
  const align = config.textAlignment || 'center';

  return StyleSheet.create({
    page: {
      fontFamily: 'Courier',
      fontSize: config.fontSize === 'small' ? 8 : config.fontSize === 'medium' ? 10 : 12,
      padding: 15,
      backgroundColor: '#ffffff',
    },
    // Dynamic alignments
    container: { textAlign: align, alignItems: align === 'center' ? 'center' : 'flex-start' },

    header: {
      marginBottom: 10,
      borderBottomWidth: config.template === 'minimal' ? 0 : 1,
      borderBottomStyle: 'dashed',
      borderBottomColor: '#999',
      paddingBottom: 5,
      width: '100%',
    },
    logo: {
      width: 80,
      height: 40,
      objectFit: 'contain',
      marginBottom: 5,
      alignSelf:
        config.logoPosition === 'center' ? 'center' : config.logoPosition === 'right' ? 'flex-end' : 'flex-start',
    },
    businessName: { fontSize: 14, marginBottom: 2, textAlign: align, fontFamily: 'Helvetica-Bold' },
    subText: { fontSize: 8, color: '#444', marginBottom: 1, textAlign: align },

    section: { marginBottom: 8, width: '100%' },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    rowLabel: { color: '#555' },
    rowValue: { fontWeight: 'bold' },

    tableHeader: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#000',
      paddingBottom: 2,
      marginBottom: 4,
      fontWeight: 'bold',
    },
    tableRow: { flexDirection: 'row', marginBottom: 4 },
    colItem: { width: '45%' },
    colQty: { width: '15%', textAlign: 'center' },
    colPrice: { width: '20%', textAlign: 'right' },
    colTotal: { width: '20%', textAlign: 'right' },

    totals: {
      marginTop: 5,
      borderTopWidth: config.template === 'modern' ? 0 : 1,
      borderTopStyle: 'dashed',
      borderTopColor: '#999',
      paddingTop: 5,
      backgroundColor: config.template === 'modern' ? '#f0f0f0' : '#ffffff',
      padding: config.template === 'modern' ? 5 : 0,
    },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    grandTotal: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 4,
      borderTopWidth: 1,
      borderColor: '#000',
      paddingTop: 4,
      fontWeight: 'bold',
      fontSize: 12,
    },

    footer: {
      marginTop: 10,
      borderTopWidth: config.template === 'modern' ? 0 : 1,
      borderTopStyle: 'dashed',
      borderTopColor: '#999',
      paddingTop: 10,
      alignItems: align === 'center' ? 'center' : 'flex-start',
    },
    policyBox: { marginTop: 5, padding: 5, borderWidth: 1, borderColor: '#eee', width: '100%' },
  });
};

export const ReceiptPdfDocument = ({ order, settings, qrCodeUrl }: ReceiptPdfProps) => {
  const styles = createStyles(settings);
  const config = settings.receiptConfig as ReceiptConfig;
  const pageSize =
    config.paperSize === '58mm'
      ? { width: 164, height: 2000 }
      : config.paperSize === 'Letter'
      ? 'LETTER'
      : { width: 226, height: 2000 };

  return (
    <Document>
      <Page size={pageSize} style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.container}>
            {config.showLogo && config.logoUrl && <Image src={config.logoUrl} style={styles.logo} />}
            <Text style={styles.businessName}>{settings.businessName}</Text>
            {config.headerText && <Text style={styles.subText}>{config.headerText}</Text>}
            {config.showAddress && <Text style={styles.subText}>{config.address}</Text>}
            {config.showPhone && <Text style={styles.subText}>{config.phone}</Text>}
            {config.showTaxNumber && <Text style={styles.subText}>Tax: {config.taxNumber}</Text>}
          </View>
        </View>

        {/* Metadata */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Order No:</Text>
            <Text style={styles.rowValue}>{order.orderNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Date:</Text>
            <Text>{format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm')}</Text>
          </View>
          {config.showCustomerName && order.customerName && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Customer:</Text>
              <Text>{order.customerName}</Text>
            </View>
          )}
          {config.showCashier && order.cashierName && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Server:</Text>
              <Text>{order.cashierName}</Text>
            </View>
          )}
          {config.showPaymentMethod && order.paymentMethod && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Pay Method:</Text>
              <Text>{order.paymentMethod}</Text>
            </View>
          )}
        </View>

        {/* Items */}
        <View style={styles.section}>
          <View style={styles.tableHeader}>
            <Text style={styles.colItem}>Item</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colPrice}>Price</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {order.items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={styles.colItem}>
                <Text>{item.productName}</Text>
                {config.showItemSku && item.sku && <Text style={{ fontSize: 8, color: '#666' }}>SKU: {item.sku}</Text>}
              </View>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{item.selectedUnit?.price.toLocaleString()}</Text>
              <Text style={styles.colTotal}>{(item.selectedUnit?.price || 0 * item.quantity).toLocaleString()}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal:</Text>
            <Text>
              {settings.currency} {order.subTotal.toLocaleString()}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Tax:</Text>
            <Text>
              {settings.currency} {order.taxes.toLocaleString()}
            </Text>
          </View>
          <View style={styles.grandTotal}>
            <Text>TOTAL:</Text>
            <Text>
              {settings.currency} {order.total.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          {config.footerText && <Text style={styles.subText}>{config.footerText}</Text>}

          {config.showReturnPolicy && config.returnPolicyText && (
            <View style={styles.policyBox}>
              <Text style={{ fontSize: 8, fontWeight: 'bold' }}>Return Policy:</Text>
              <Text style={{ fontSize: 7 }}>{config.returnPolicyText}</Text>
            </View>
          )}

          {config.showSocialMedia && config.socialMediaHandle && (
            <Text style={{ fontSize: 9, marginTop: 5, fontWeight: 'bold' }}>Follow: {config.socialMediaHandle}</Text>
          )}

          {config.showQrCode && qrCodeUrl && <Image src={qrCodeUrl} style={{ width: 60, height: 60, marginTop: 5 }} />}

          <Text style={{ fontSize: 8, marginTop: 5, color: '#888' }}>Powered by Dealio POS</Text>
        </View>
      </Page>
    </Document>
  );
};
