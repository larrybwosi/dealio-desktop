'use client';

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Order } from '@/store/store';
import { format } from 'date-fns';

// ----------------------------------------------------------------
// 1. Base Styles for Professional Kitchen Ticket / Thermal Printer
// ----------------------------------------------------------------
const styles = StyleSheet.create({
  // General Ticket Layout (mostly controlled by dynamicStyles.page for size)
  ticketHeader: {
    marginBottom: 10,
    paddingBottom: 5,
    borderBottom: '2pt solid #000',
    textAlign: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  orderNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  infoSection: {
    marginBottom: 10,
    borderBottom: '1pt solid #000',
    paddingBottom: 5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
    // Base font size for info rows is controlled by dynamicStyles.page
  },
  label: {
    fontWeight: 'bold',
    marginRight: 5,
  },
  tableNumber: {
    fontSize: 22, // Extra large for table number
    fontWeight: 'heavy',
    color: '#D9534F', // Example: Use a color for high visibility, if supported
  },
  itemsSection: {
    marginTop: 10,
  },
  itemContainer: {
    marginBottom: 8,
    paddingVertical: 5,
  },
  itemNameQuantity: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Item details are now nested under dynamic styles for size control
  itemDetails: {
    color: '#444',
    marginLeft: 30, // Indent for modifiers/details
    marginTop: 2,
  },
  instructions: {
    marginTop: 15,
    padding: 8,
    backgroundColor: '#fff3cd', // Light yellow background for instructions
    borderLeft: '4pt solid #ffc107', // Yellow left border for emphasis
  },
  instructionsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  instructionsText: {
    // Font size controlled by dynamic styles
  },
  footer: {
    marginTop: 15,
    borderTop: '2pt dashed #000',
    paddingTop: 5,
    textAlign: 'center',
  },
  timestamp: {
    fontSize: 8,
    color: '#666',
  },
  // Utility for separating items clearly
  dashedLine: {
    borderBottom: '1pt dashed #444',
    marginVertical: 4,
  },
});

// ----------------------------------------------------------------
// 2. Component Interface and Configuration
// ----------------------------------------------------------------
interface PDFKitchenTicketProps {
  order: Order;
  kitchenTicketConfig?: {
    showTime: boolean;
    showOrderType: boolean;
    showCustomerName: boolean;
    showTable: boolean;
    showPrices: boolean;
    showNotes: boolean;
    fontSize: 'small' | 'medium' | 'large';
    paperSize: '80mm' | '58mm' | 'A5';
  };
}

export const PDFKitchenTicket = ({ order, kitchenTicketConfig }: PDFKitchenTicketProps) => {
  const config =
    kitchenTicketConfig ||
    ({
      showTime: true,
      showOrderType: true,
      showCustomerName: true,
      showTable: true,
      showPrices: false,
      showNotes: true,
      fontSize: 'medium',
      paperSize: '80mm',
    } as const);

  // Determine base font size based on config
  const baseFontSize = config.fontSize === 'small' ? 9 : config.fontSize === 'large' ? 14 : 11;
  const itemFontSize = baseFontSize + 2; // Slightly larger for item names
  const qtyFontSize = baseFontSize + 6; // Significantly larger for quantity

  // Dynamic Styles (based on font size and paper size)
  const dynamicStyles = StyleSheet.create({
    page: {
      padding: config.paperSize === 'A5' ? 20 : 10, // Less padding for thermal sizes
      fontSize: baseFontSize,
      fontFamily: 'Helvetica',
      // Set fixed widths for thermal sizes (in points)
      width: config.paperSize === '58mm' ? 164 : config.paperSize === '80mm' ? 226 : '100%',
    },
    itemName: {
      fontSize: itemFontSize,
      fontWeight: 'bold',
      flex: 1, // Allow name to take remaining space
      textTransform: 'uppercase',
    },
    quantity: {
      fontSize: qtyFontSize,
      fontWeight: 'heavy',
      marginRight: 10,
      minWidth: 30,
      textAlign: 'center',
    },
    instructionsText: {
      fontSize: baseFontSize,
    },
    itemPrice: {
      fontSize: baseFontSize,
    },
  });

  const getPageSize = (): 'A5' | [number, number] => {
    switch (config.paperSize) {
      case '58mm':
        return [164, 800]; // Width, Max Height
      case '80mm':
        return [226, 800]; // Width, Max Height
      default:
        return 'A5';
    }
  };

  return (
    <Document>
      <Page size={getPageSize()} style={dynamicStyles.page}>
        {/* ----------------- Header ----------------- */}
        <View style={styles.ticketHeader}>
          <Text style={styles.title}>KITCHEN ORDER</Text>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
        </View>

        {/* ----------------- Order Info ----------------- */}
        <View style={styles.infoSection}>
          {config.showTable && order.tableNumber && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>TABLE:</Text>
              {/* Highlight table number prominently */}
              <Text style={styles.tableNumber}>{order.tableNumber}</Text>
            </View>
          )}

          {config.showOrderType && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>ORDER TYPE:</Text>
              <Text style={{ textTransform: 'uppercase' }}>{order.orderType}</Text>
            </View>
          )}

          {config.showCustomerName && order.customerName && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>CUSTOMER:</Text>
              <Text>{order.customerName}</Text>
            </View>
          )}

          {config.showTime && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>TIME:</Text>
              <Text>{format(new Date(order.createdAt), 'HH:mm')}</Text>
            </View>
          )}
        </View>

        {/* ----------------- Items ----------------- */}
        <View style={styles.itemsSection}>
          {order.items.map((item, index) => (
            <View key={index} style={styles.itemContainer}>
              {/* Item Name and Quantity on one line, emphasized */}
              <View style={styles.itemNameQuantity}>
                <Text style={dynamicStyles.quantity}>{item.quantity}x</Text>
                <Text style={dynamicStyles.itemName}>{item.productName}</Text>
                {/* Optional: Show Price */}
                {config.showPrices && (
                  <Text style={dynamicStyles.itemPrice}>
                    ${((item.selectedUnit?.price || 0) * item.quantity).toFixed(2)}
                  </Text>
                )}
              </View>

              {/* Variant and Unit details (if not default) */}
              {(item.variantName !== 'Default Variant' || item.selectedUnit?.unitName) && (
                <Text style={styles.itemDetails}>
                  {item.variantName !== 'Default Variant' && `${item.variantName} `}
                  {item.selectedUnit?.unitName && `(${item.selectedUnit.unitName})`}
                </Text>
              )}
              <View style={styles.dashedLine} />
            </View>
          ))}
        </View>

        {/* ----------------- Special Instructions ----------------- */}
        {config.showNotes && order.instructions && (
          <View style={styles.instructions}>
            <Text style={styles.instructionsTitle}>*** SPECIAL INSTRUCTIONS ***</Text>
            <Text style={dynamicStyles.instructionsText}>{order.instructions}</Text>
          </View>
        )}

        {/* ----------------- Footer ----------------- */}
        <View style={styles.footer}>
          <Text style={styles.timestamp}>Order Placed: {format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm:ss')}</Text>
          <Text style={styles.timestamp}>Ticket Printed: {format(new Date(), 'dd/MM/yyyy HH:mm:ss')}</Text>
        </View>
      </Page>
    </Document>
  );
};
