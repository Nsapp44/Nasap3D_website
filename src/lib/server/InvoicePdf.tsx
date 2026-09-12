import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { sharedPdfStyles, INK, MUTED, BORDER, eur, PdfHeader, PdfIssuerBlock, PdfInclusionsBlock, PdfPageFooter } from "../pdf/pdfShared";

// Self-generated invoice — replaces relying on Stripe's own invoice PDF
// (which needed a real Stripe session/webhook to exist at all). Built
// entirely from data already on Order/OrderItem/User at the moment a
// payment is confirmed
// (webhook OR the admin's "Forcer → Payée"), so it's never blocked by
// Stripe being unreachable, misconfigured, or a webhook delivery failing.
//
// @react-pdf/renderer renders via its own layout engine (Yoga/flexbox),
// not a browser — no Chromium/Puppeteer, no native 3D/GL rendering. Cheap:
// confirmed live, a real invoice like this renders in well under 100ms and
// a few MB of transient memory, negligible next to the STL-parsing work
// this same server already does for every quote.

const styles = StyleSheet.create({
  table: { borderTopWidth: 1, borderTopColor: INK, borderBottomWidth: 1, borderBottomColor: BORDER },
  tHeadRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: INK, paddingVertical: 6 },
  tRow: { flexDirection: "row", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: BORDER },
  tHeadCell: { fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: MUTED },
  colDesc: { width: "46%" },
  colSpec: { width: "24%" },
  colQty: { width: "8%", textAlign: "center" },
  colUnit: { width: "11%", textAlign: "right" },
  colTotal: { width: "11%", textAlign: "right" },

  itemName: { fontSize: 10, fontWeight: 600, marginBottom: 2 },
  itemMaterial: { fontSize: 8.5, color: MUTED },
  specLine: { fontSize: 8.5, color: MUTED, lineHeight: 1.5 },
  colorDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4, borderWidth: 0.5, borderColor: BORDER },
  colorRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
});

export interface InvoicePdfItem {
  nameSnapshot: string;
  materialSnapshot: string;
  colorNameSnapshot: string;
  colorHexSnapshot: string;
  infillSnapshot: number;
  qualitySnapshot: string;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface InvoicePdfData {
  ref: string;
  issuedAt: Date;
  customerNo: string;
  billedToName: string;
  billedToAddress?: string | null;
  items: InvoicePdfItem[];
  shippingCents: number;
  totalCents: number;
}

export function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  const itemsSubtotal = data.totalCents - data.shippingCents;
  return (
    <Document>
      <Page size="A4" style={sharedPdfStyles.page}>
        <PdfHeader title="FACTURE" refLabel={`N° ${data.ref}`} date={data.issuedAt} />

        <View style={sharedPdfStyles.partiesRow}>
          <PdfIssuerBlock />
          <View style={sharedPdfStyles.partyBlock}>
            <Text style={sharedPdfStyles.partyLabel}>Facturé à</Text>
            <Text style={[sharedPdfStyles.partyLine, { fontWeight: 600 }]}>{data.billedToName}</Text>
            {data.billedToAddress && <Text style={sharedPdfStyles.partyLineMuted}>{data.billedToAddress}</Text>}
            <Text style={sharedPdfStyles.partyLineMuted}>N° client : {data.customerNo}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tHeadRow}>
            <Text style={[styles.tHeadCell, styles.colDesc]}>Pièce</Text>
            <Text style={[styles.tHeadCell, styles.colSpec]}>Caractéristiques</Text>
            <Text style={[styles.tHeadCell, styles.colQty]}>Qté</Text>
            <Text style={[styles.tHeadCell, styles.colUnit]}>PU</Text>
            <Text style={[styles.tHeadCell, styles.colTotal]}>Total</Text>
          </View>
          {data.items.map((item, i) => (
            <View key={i} style={styles.tRow} wrap={false}>
              <View style={styles.colDesc}>
                <Text style={styles.itemName}>{item.nameSnapshot}</Text>
                <Text style={styles.itemMaterial}>{item.materialSnapshot}</Text>
              </View>
              <View style={styles.colSpec}>
                <Text style={styles.specLine}>{item.qualitySnapshot} · {item.infillSnapshot}% remplissage</Text>
                <View style={styles.colorRow}>
                  <View style={[styles.colorDot, { backgroundColor: item.colorHexSnapshot }]} />
                  <Text style={styles.specLine}>{item.colorNameSnapshot}</Text>
                </View>
              </View>
              <Text style={[styles.specLine, styles.colQty]}>×{item.qty}</Text>
              <Text style={[styles.specLine, styles.colUnit]}>{eur(item.unitPriceCents)}</Text>
              <Text style={[styles.itemName, styles.colTotal]}>{eur(item.lineTotalCents)}</Text>
            </View>
          ))}
        </View>

        <View style={sharedPdfStyles.totalsRow}>
          <PdfInclusionsBlock />
          <View style={sharedPdfStyles.totalsInner}>
            <View style={sharedPdfStyles.totalRow}>
              <Text style={sharedPdfStyles.totalLabel}>Sous-total pièces</Text>
              <Text style={sharedPdfStyles.totalValue}>{eur(itemsSubtotal)}</Text>
            </View>
            {data.shippingCents > 0 && (
              <View style={sharedPdfStyles.totalRow}>
                <Text style={sharedPdfStyles.totalLabel}>Livraison</Text>
                <Text style={sharedPdfStyles.totalValue}>{eur(data.shippingCents)}</Text>
              </View>
            )}
            <View style={sharedPdfStyles.grandRow}>
              <Text style={sharedPdfStyles.grandLabel}>TOTAL TTC</Text>
              <Text style={sharedPdfStyles.grandValue}>{eur(data.totalCents)}</Text>
            </View>
          </View>
        </View>

        <View style={sharedPdfStyles.footerBlock}>
          <Text style={sharedPdfStyles.footerTitle}>Conditions et modalités de paiement</Text>
          <Text style={sharedPdfStyles.footerLine}>Payé en ligne par carte bancaire via Stripe à la validation de la commande.</Text>
          <Text style={sharedPdfStyles.legalMention}>TVA non applicable, art. 293 B du CGI</Text>
        </View>

        <PdfPageFooter />
      </Page>
    </Document>
  );
}
