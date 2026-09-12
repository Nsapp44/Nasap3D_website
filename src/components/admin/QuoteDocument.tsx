import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { sharedPdfStyles, INK, MUTED, BORDER, eur, PdfHeader, PdfIssuerBlock, PdfInclusionsBlock, PdfPageFooter } from "../../lib/pdf/pdfShared";

// Devis (quote) builder — same visual template as the invoice
// (src/lib/server/InvoicePdf.tsx, shares its chrome via pdfShared.tsx), but
// rendered entirely in the admin's browser, not the server: nothing here is
// ever persisted (no DB row, no Order/Invoice, no file saved anywhere) — the
// admin composes a list of prestations on screen, clicks "Créer le devis",
// and this renders straight to a Blob download in their own browser. No
// photos (unlike a real order, there's no printed piece yet to show).
const styles = StyleSheet.create({
  table: { borderTopWidth: 1, borderTopColor: INK, borderBottomWidth: 1, borderBottomColor: BORDER },
  tHeadRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: INK, paddingVertical: 6 },
  tRow: { flexDirection: "row", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: BORDER },
  tHeadCell: { fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: MUTED },
  colDesc: { width: "50%" },
  colSpec: { width: "30%" },
  colPrice: { width: "20%", textAlign: "right" },

  itemName: { fontSize: 10, fontWeight: 600, lineHeight: 1.4 },
  specLine: { fontSize: 8.5, color: MUTED, lineHeight: 1.5 },
  colorDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4, borderWidth: 0.5, borderColor: BORDER },
  colorRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  priceValue: { fontSize: 10, fontWeight: 600 },
});

export interface QuotePdfItem {
  label: string;
  detail?: string | null;
  colorHex?: string | null;
  colorName?: string | null;
  priceCents: number;
  isPrint?: boolean;
}

export interface QuotePdfData {
  ref: string;
  issuedAt: Date;
  clientName?: string | null;
  items: QuotePdfItem[];
  totalCents: number;
}

export function QuoteDocument({ data }: { data: QuotePdfData }) {
  const hasPrintItem = data.items.some((it) => it.isPrint);
  return (
    <Document>
      <Page size="A4" style={sharedPdfStyles.page}>
        <PdfHeader title="DEVIS" refLabel={`N° ${data.ref}`} date={data.issuedAt} />

        <View style={sharedPdfStyles.partiesRow}>
          <PdfIssuerBlock />
          {data.clientName && (
            <View style={sharedPdfStyles.partyBlock}>
              <Text style={sharedPdfStyles.partyLabel}>Devis pour</Text>
              <Text style={[sharedPdfStyles.partyLine, { fontWeight: 600 }]}>{data.clientName}</Text>
            </View>
          )}
        </View>

        <View style={styles.table}>
          <View style={styles.tHeadRow}>
            <Text style={[styles.tHeadCell, styles.colDesc]}>Prestation</Text>
            <Text style={[styles.tHeadCell, styles.colSpec]}>Détails</Text>
            <Text style={[styles.tHeadCell, styles.colPrice]}>Prix</Text>
          </View>
          {data.items.map((item, i) => (
            <View key={i} style={styles.tRow} wrap={false}>
              <View style={styles.colDesc}>
                <Text style={styles.itemName}>{item.label}</Text>
              </View>
              <View style={styles.colSpec}>
                {item.detail && <Text style={styles.specLine}>{item.detail}</Text>}
                {item.colorName && (
                  <View style={styles.colorRow}>
                    <View style={[styles.colorDot, { backgroundColor: item.colorHex || "#ffffff" }]} />
                    <Text style={styles.specLine}>{item.colorName}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.priceValue, styles.colPrice]}>{eur(item.priceCents)}</Text>
            </View>
          ))}
        </View>

        <View style={sharedPdfStyles.totalsRow}>
          {hasPrintItem ? <PdfInclusionsBlock /> : <View />}
          <View style={sharedPdfStyles.totalsInner}>
            <View style={sharedPdfStyles.grandRow}>
              <Text style={sharedPdfStyles.grandLabel}>TOTAL TTC</Text>
              <Text style={sharedPdfStyles.grandValue}>{eur(data.totalCents)}</Text>
            </View>
          </View>
        </View>

        <View style={sharedPdfStyles.footerBlock}>
          <Text style={sharedPdfStyles.footerTitle}>Validité et modalités</Text>
          <Text style={sharedPdfStyles.footerLine}>Devis valable 30 jours à compter de la date d'émission. Paiement à la commande.</Text>
          <Text style={sharedPdfStyles.legalMention}>TVA non applicable, art. 293 B du CGI</Text>
        </View>

        <PdfPageFooter />
      </Page>
    </Document>
  );
}
