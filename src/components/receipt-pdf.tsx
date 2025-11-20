'use client';

import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';
import type { Order } from '@/store/store';

// Register a font that supports good tabular data (optional, using standard Helvetica here)
Font.register({
  family: 'Courier',
  src: 'https://fonts.gstatic.com/s/courierprime/v9/u-450wd2gHbuK602K24.ttf',
});

interface ReceiptPdfProps {
  order: Order;
  settings: any; // Replace with your specific Settings type
  qrCodeUrl?: string;
}

const createStyles = (settings: any) =>
  StyleSheet.create({
    page: {
      fontFamily: 'Courier',
      fontSize:
        settings.receiptConfig.fontSize === 'small' ? 8 : settings.receiptConfig.fontSize === 'medium' ? 10 : 12,
      padding: 15,
      backgroundColor: '#ffffff',
    },
    center: { textAlign: 'center', alignItems: 'center' },
    left: { textAlign: 'left' },
    right: { textAlign: 'right' },
    bold: { fontWeight: 'bold', fontFamily: 'Helvetica-Bold' }, // Fallback for bold

    header: {
      marginBottom: 10,
      borderBottomWidth: 1,
      borderBottomStyle: 'dashed',
      borderBottomColor: '#999',
      paddingBottom: 5,
    },
    logo: { width: 100, height: 50, objectFit: 'contain', marginBottom: 5 },
    businessName: { fontSize: 14, marginBottom: 2, textAlign: 'center' },
    subText: { fontSize: 8, color: '#444', marginBottom: 1, textAlign: 'center' },

    section: { marginBottom: 8 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },

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

    totals: { marginTop: 5, borderTopWidth: 1, borderTopStyle: 'dashed', borderTopColor: '#999', paddingTop: 5 },
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
      borderTopWidth: 1,
      borderTopStyle: 'dashed',
      borderTopColor: '#999',
      paddingTop: 10,
      alignItems: 'center',
    },
  });

export const ReceiptPdfDocument = ({ order, settings, qrCodeUrl }: ReceiptPdfProps) => {
  const styles = createStyles(settings);
  const config = settings.receiptConfig;

  // Calculate width based on mm setting (approximate points: 1mm = 2.83pt)
  const pageSize = config.paperSize === '58mm' ? [164, 'auto'] : [226, 'auto'];

  return (
    <Document>
      <Page size={pageSize as any} style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.center}>
            {config.showLogo && config.logoUrl && (
              // Note: Image requires a valid URL or base64.
              // If local, you might need to handle CORS or use base64 strings.
              <Image src={config.logoUrl} style={styles.logo} />
            )}
            <Text style={styles.businessName}>{settings.businessName}</Text>
            {config.headerText && <Text style={styles.subText}>{config.headerText}</Text>}
            {config.showAddress && <Text style={styles.subText}>{config.address}</Text>}
            {config.showPhone && <Text style={styles.subText}>Tel: {config.phone}</Text>}
            {config.showEmail && <Text style={styles.subText}>{config.email}</Text>}
            {config.showTaxNumber && <Text style={styles.subText}>Tax ID: {config.taxNumber}</Text>}
          </View>
        </View>

        {/* Order Info */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text>Order No:</Text>
            <Text>{order.orderNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text>Date:</Text>
            <Text>{format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm')}</Text>
          </View>
          {order.customerName && (
            <View style={styles.row}>
              <Text>Customer:</Text>
              <Text>{order.customerName}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text>Type:</Text>
            <Text>{order.orderType}</Text>
          </View>
        </View>

        {/* Items Table */}
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
                <Text style={{ fontSize: 8, color: '#666' }}>{item.variantName}</Text>
              </View>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{(item.selectedUnit?.price || 0).toLocaleString()}</Text>
              <Text style={styles.colTotal}>{((item.selectedUnit?.price || 0) * item.quantity).toLocaleString()}</Text>
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
          {order.discount > 0 && (
            <View style={styles.totalRow}>
              <Text>Discount:</Text>
              <Text>
                -{settings.currency} {order.discount.toLocaleString()}
              </Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text>Tax ({settings.taxRate}%):</Text>
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

          {/* QR Code - passed as image data url from parent */}
          {config.showQrCode && qrCodeUrl && <Image src={qrCodeUrl} style={{ width: 60, height: 60, marginTop: 5 }} />}

          <Text style={{ fontSize: 8, marginTop: 5, color: '#888' }}>Powered by Enterprise POS</Text>
        </View>
      </Page>
    </Document>
  );
};
