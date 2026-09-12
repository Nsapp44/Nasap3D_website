import { StyleSheet, Svg, Path, Rect, View, Text } from "@react-pdf/renderer";

// Shared between the server-generated invoice (src/lib/server/InvoicePdf.tsx,
// rendered in a subprocess — see invoicePdfSubprocess.ts) and the admin's
// client-side devis builder (src/components/admin/QuoteDocument.tsx,
// rendered directly in the browser) — same brand chrome (logo, colors,
// header/footer/totals layout) in both, defined once instead of copy-pasted
// twice. Deliberately has zero Node-only imports (no fs/path) so it can be
// bundled for the browser exactly as-is.

export const ACCENT = "#ff5a3c";
export const INK = "#161514";
export const MUTED = "#6b6660";
export const BORDER = "#e5e2dd";

export function eur(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}
export function fmtDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// No custom font registered: no TTF files exist anywhere in this repo to
// point at, and registering a nonexistent path would throw ENOENT at render
// time. Helvetica is one of the 14 PDF standard fonts — built into every PDF
// reader/renderer, zero bytes embedded, zero file I/O. react-pdf resolves
// fontWeight 600/700 to Helvetica-Bold automatically without any setup.
export const sharedPdfStyles = StyleSheet.create({
  page: { padding: 42, fontFamily: "Helvetica", fontSize: 9.5, color: INK },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 30 },
  logoRow: { flexDirection: "row", alignItems: "center" },
  logoIcon: { width: 22, height: 26.2, marginRight: 8 },
  logoText: { fontSize: 17, fontWeight: 700, letterSpacing: 0.2 },
  docTitle: { fontSize: 22, fontWeight: 700, letterSpacing: 0.5, textAlign: "right" },
  docMeta: { marginTop: 6, textAlign: "right" },
  docMetaLabel: { fontSize: 8, color: MUTED },
  docMetaValue: { fontSize: 10, fontWeight: 600 },

  partiesRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 26 },
  partyBlock: { width: "46%" },
  partyLabel: { fontSize: 8, fontWeight: 600, color: ACCENT, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  partyLine: { fontSize: 9.5, lineHeight: 1.5 },
  partyLineMuted: { fontSize: 9.5, lineHeight: 1.5, color: MUTED },

  totalsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 16 },
  totalsInner: { width: 200 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalLabel: { fontSize: 9, color: MUTED },
  totalValue: { fontSize: 9 },
  grandRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: INK, padding: 10, marginTop: 6, borderRadius: 3 },
  grandLabel: { fontSize: 11, fontWeight: 700, color: "#f3f1ec" },
  grandValue: { fontSize: 13, fontWeight: 700, color: ACCENT },

  footerBlock: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: BORDER },
  footerTitle: { fontSize: 8, fontWeight: 600, marginBottom: 4 },
  footerLine: { fontSize: 8, color: MUTED, lineHeight: 1.5 },
  legalMention: { fontSize: 8, fontWeight: 600, marginTop: 10 },

  inclusionsBlock: { width: 240 },
  inclusionsTitle: { fontSize: 9.5, fontWeight: 700, fontStyle: "italic", color: INK, marginBottom: 4 },
  inclusionsLine: { fontSize: 9, fontStyle: "italic", color: INK, lineHeight: 1.7 },

  pageFooter: { position: "absolute", bottom: 28, left: 42, right: 42, textAlign: "center", fontSize: 7.5, color: MUTED },
});

// Shown on the invoice whenever it has any 3D-printed item, and on the
// devis whenever it has at least one "Impression 3D" prestation — same
// block, same wording, in both documents.
export function PdfInclusionsBlock() {
  return (
    <View style={sharedPdfStyles.inclusionsBlock}>
      <Text style={sharedPdfStyles.inclusionsTitle}>Ces prix comprennent :</Text>
      <Text style={sharedPdfStyles.inclusionsLine}>- Préparation du fichier</Text>
      <Text style={sharedPdfStyles.inclusionsLine}>- Approvisionnement matière</Text>
      <Text style={sharedPdfStyles.inclusionsLine}>- Impression 3D</Text>
      <Text style={sharedPdfStyles.inclusionsLine}>- Nettoyage impression 3D</Text>
    </View>
  );
}

// Logo rendered as native PDF vector paths, not a raster image — no bitmap
// decode at all (measured cheaper and simpler than the raster-image
// approach tried first, see this file's git history / invoicePdfWorker.mts
// comment). Path data copied 1:1 from the provided source SVG (the
// print-head mark only, no wordmark — "Nasap3D" is set as real text next to
// it, itself already vector via the embedded font).
export function LogoIcon() {
  return (
    <Svg viewBox="0 0 172.42 205.63" style={sharedPdfStyles.logoIcon}>
      <Path d="M59.71,194.71l-33.25-.17c-1.62,1.48-2.71,4.26-2.51,6.19.15,1.45,1.69,4.28,3.15,4.9l32.72-.03c3.43-2.86,3.35-9.13-.12-10.89Z" fill={INK} />
      <Path d="M60.71,182.05c.95-1.25,2.43-5.42.85-6.56l-25.74-18.35c-1.72-1.23-4.98,1.2-5.93,2.53-1.02,1.42-1.72,4.15-1.08,6.07l26.36,18.87c1.86.35,4.6-1.3,5.55-2.55Z" fill={INK} />
      <Path d="M142.16,185.1c9.62-5.6,17.8-11.77,26.64-17.93.94-1.78.3-5.18-.92-6.66-.95-1.15-3.36-2.6-5.11-2.6-9.2,6.27-17.93,11.88-26.6,18.66-2.86,2.24,2.43,10.61,5.99,8.54Z" fill={INK} />
      <Path d="M169.77,194.16c-10.92-.63-21.66-.75-32.45.1-3.65.29-3.61,9.87.16,10.16,10.69.82,21.3.67,32.34.1,3.51-1.32,3.45-9.88-.04-10.36Z" fill={INK} />
      <Path d="M155.64,5.68c-.08-1.94-1.27-4.4-3.17-5.68H3.31C1.36,1.06-.06,3.85,0,5.61c.06,1.76,1.17,4.05,2.54,5.55l20.55.12.08,10.48c.02,3.21,1.74,5.92,5.34,5.92h19.65s0,43.18,0,43.18c0,3.72,1.91,7.53,3.59,10.53l6.62.24.25,22.13c.02,1.49,1.6,4.09,2.78,4.78,1.21.7,4.09.72,6.02.69v95.73s16.4-.02,16.4-.02l.17-63.22,27.68,63.19h17.87s0-97.83,0-97.83l-16.44-.02-.17,65.52-27.01-63.2,6.12-.4c1.68-1.21,3.07-4.91,3.07-7.13l.03-20.19,7.9-.34c1.4-2.93,3.21-6.39,3.21-9.66l.08-43.96,21.11-.04c1.54,0,4.26-2.81,4.28-4.33l.19-12.04,20.87-.12c1.52-.86,2.94-3.83,2.87-5.48ZM83.89,97.26h-12.72v-15.71h12.72v15.71ZM93.61,70.46h-32.87V27.68h32.87v42.78ZM119.02,16.5H35.99v-5.28h83.03v5.28Z" fill={INK} />
      <Rect x="60.75" y="27.68" width="32.87" height="42.78" fill="#ffffff" />
      <Rect x="35.99" y="11.22" width="83.03" height="5.28" fill="#ffffff" />
      <Rect x="71.16" y="81.54" width="12.72" height="15.71" fill="#ffffff" />
    </Svg>
  );
}

// The header row (logo + doc title/ref/date) is identical in shape between
// the invoice and the devis, only the title text and ref/date value differ
// — factored out so neither document repeats the JSX structure.
export function PdfHeader({ title, refLabel, date }: { title: string; refLabel: string; date: Date }) {
  return (
    <View style={sharedPdfStyles.headerRow}>
      <View style={sharedPdfStyles.logoRow}>
        <LogoIcon />
        <Text style={sharedPdfStyles.logoText}>Nasap3D</Text>
      </View>
      <View>
        <Text style={sharedPdfStyles.docTitle}>{title}</Text>
        <View style={sharedPdfStyles.docMeta}>
          <Text style={sharedPdfStyles.docMetaLabel}>{refLabel}</Text>
          <Text style={sharedPdfStyles.docMetaValue}>{fmtDate(date)}</Text>
        </View>
      </View>
    </View>
  );
}

// The "Émetteur" (issuer) side of the parties row never changes — the same
// fixed Nasap3D business details on both documents.
export function PdfIssuerBlock() {
  return (
    <View style={sharedPdfStyles.partyBlock}>
      <Text style={sharedPdfStyles.partyLabel}>Émetteur</Text>
      <Text style={[sharedPdfStyles.partyLine, { fontWeight: 600 }]}>Nasap3D</Text>
      <Text style={sharedPdfStyles.partyLineMuted}>29 rue Mellier</Text>
      <Text style={sharedPdfStyles.partyLineMuted}>44100 Nantes</Text>
      <Text style={sharedPdfStyles.partyLineMuted}>06 61 43 05 06</Text>
      <Text style={sharedPdfStyles.partyLineMuted}>SIRET : 920 178 753 00017</Text>
    </View>
  );
}

export function PdfPageFooter() {
  return (
    <Text style={sharedPdfStyles.pageFooter} fixed>
      Nasap3D — 29 rue Mellier, 44100 Nantes — SIRET 920 178 753 00017
    </Text>
  );
}
