import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { Invoice } from '@/services/billing.service';
import { formatDateLong, formatTime } from '@/lib/date';

const COLORS = {
  primary: '#f2771a',
  text: '#1c2128',
  textMuted: '#6b7280',
  border: '#e2e8f0',
  borderSubtle: '#f0f4f8',
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: COLORS.text, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: `1pt solid ${COLORS.border}`,
    paddingBottom: 16,
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: 700 },
  invoiceNumber: { fontSize: 12, color: COLORS.primary, fontWeight: 700, marginTop: 4 },
  metaColumn: { alignItems: 'flex-end' },
  metaDate: { fontSize: 9, color: COLORS.textMuted },
  metaTime: { fontSize: 9, color: COLORS.textMuted, marginTop: 3 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: COLORS.textMuted, marginBottom: 6 },
  buyerField: { fontSize: 10, marginBottom: 2 },
  table: { marginBottom: 16 },
  tableRow: { flexDirection: 'row', borderBottom: `1pt solid ${COLORS.borderSubtle}` },
  tableHeaderRow: { flexDirection: 'row', borderBottom: `1pt solid ${COLORS.border}` },
  th: { fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: COLORS.textMuted, paddingVertical: 6, paddingHorizontal: 4 },
  td: { fontSize: 10, paddingVertical: 8, paddingHorizontal: 4 },
  colDesc: { flex: 3 },
  colRight: { flex: 1, textAlign: 'right' },
  totals: { alignSelf: 'flex-end', width: 220, borderTop: `1pt solid ${COLORS.border}`, paddingTop: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 10, color: COLORS.textMuted, marginBottom: 4 },
  totalFinal: { fontSize: 12, fontWeight: 700, color: COLORS.text, marginTop: 2 },
  notes: { fontSize: 9, color: COLORS.textMuted, marginTop: 16 },
  paymentRow: { fontSize: 9, color: COLORS.textMuted, marginTop: 8 },
});

export default function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Factura</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
          </View>
          <View style={styles.metaColumn}>
            <Text style={styles.metaDate}>Fecha: {formatDateLong(invoice.issuedAt)}</Text>
            <Text style={styles.metaTime}>Hora: {formatTime(invoice.issuedAt)}</Text>
          </View>
        </View>

        {(invoice.buyerName || invoice.buyerDoc || invoice.buyerPhone) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Comprador</Text>
            {invoice.buyerName && <Text style={styles.buyerField}>{invoice.buyerName}</Text>}
            {invoice.buyerDoc && <Text style={styles.buyerField}>Doc: {invoice.buyerDoc}</Text>}
            {invoice.buyerPhone && <Text style={styles.buyerField}>Tel: {invoice.buyerPhone}</Text>}
          </View>
        )}

        {invoice.items && invoice.items.length > 0 && (
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, styles.colDesc]}>Descripción</Text>
              <Text style={[styles.th, styles.colRight]}>Precio unit.</Text>
              <Text style={[styles.th, styles.colRight]}>Qty</Text>
              <Text style={[styles.th, styles.colRight]}>Total</Text>
            </View>
            {invoice.items.map(item => (
              <View style={styles.tableRow} key={item.id}>
                <Text style={[styles.td, styles.colDesc]}>{item.description}</Text>
                <Text style={[styles.td, styles.colRight]}>${Number(item.unitPrice).toFixed(2)}</Text>
                <Text style={[styles.td, styles.colRight]}>{item.quantity}</Text>
                <Text style={[styles.td, styles.colRight]}>${Number(item.lineTotal).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.totals}>
          <View style={styles.totalRow}><Text>Subtotal</Text><Text>${Number(invoice.subtotal).toFixed(2)}</Text></View>
          <View style={styles.totalRow}><Text>IVA ({Number(invoice.taxRate)}%)</Text><Text>${Number(invoice.taxAmount).toFixed(2)}</Text></View>
          <View style={[styles.totalRow, styles.totalFinal]}><Text>Total</Text><Text>${Number(invoice.total).toFixed(2)}</Text></View>
        </View>

        {invoice.notes && <Text style={styles.notes}>Notas: {invoice.notes}</Text>}

        <Text style={styles.paymentRow}>Método de pago: {invoice.paymentMethod}</Text>
      </Page>
    </Document>
  );
}
