"use client"

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import type { Order } from "@/lib/store"
import { format } from "date-fns"

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 12,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 15,
    borderBottom: "3pt solid #000",
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 5,
  },
  orderNumber: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 5,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
    fontSize: 11,
  },
  label: {
    fontWeight: "bold",
  },
  itemsSection: {
    marginTop: 15,
    marginBottom: 15,
  },
  item: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "bold",
  },
  quantity: {
    fontSize: 16,
    fontWeight: "bold",
    backgroundColor: "#000",
    color: "#fff",
    padding: 5,
    borderRadius: 3,
    minWidth: 40,
    textAlign: "center",
  },
  itemDetails: {
    fontSize: 10,
    color: "#666",
    marginBottom: 3,
  },
  instructions: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#fff3cd",
    borderLeft: "4pt solid #ffc107",
  },
  instructionsTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 5,
  },
  instructionsText: {
    fontSize: 11,
  },
  footer: {
    marginTop: 20,
    borderTop: "2pt dashed #000",
    paddingTop: 10,
    textAlign: "center",
  },
  timestamp: {
    fontSize: 10,
    color: "#666",
  },
})

interface PDFKitchenTicketProps {
  order: Order
  businessName: string
}

export const PDFKitchenTicket = ({ order, businessName }: PDFKitchenTicketProps) => (
  <Document>
    <Page size="A5" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>KITCHEN ORDER</Text>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
      </View>

      {/* Order Info */}
      <View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Order Type:</Text>
          <Text style={{ textTransform: "uppercase" }}>{order.orderType}</Text>
        </View>
        {order.tableNumber && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Table:</Text>
            <Text style={{ fontSize: 16, fontWeight: "bold" }}>{order.tableNumber}</Text>
          </View>
        )}
        {order.customerName && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Customer:</Text>
            <Text>{order.customerName}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={styles.label}>Time:</Text>
          <Text>{format(new Date(order.createdAt), "HH:mm")}</Text>
        </View>
      </View>

      {/* Items */}
      <View style={styles.itemsSection}>
        {order.items.map((item, index) => (
          <View key={index} style={styles.item}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemName}>{item.productName}</Text>
              <Text style={styles.quantity}>x{item.quantity}</Text>
            </View>
            <Text style={styles.itemDetails}>
              Variant: {item.variantName} | Unit: {item.selectedUnit?.unitName}
            </Text>
          </View>
        ))}
      </View>

      {/* Special Instructions */}
      {order.instructions && (
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>SPECIAL INSTRUCTIONS:</Text>
          <Text style={styles.instructionsText}>{order.instructions}</Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.timestamp}>Printed: {format(new Date(), "dd/MM/yyyy HH:mm:ss")}</Text>
        <Text style={styles.timestamp}>{businessName}</Text>
      </View>
    </Page>
  </Document>
)
