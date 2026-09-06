import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api-client";
import { useAuth } from "../hooks/useAuth";
import { useCart, MAX_LINE_QTY, type CartLine } from "../hooks/useCart";
import CartLineThumbnail from "./CartLineThumbnail";
import PhoneInput, { type PhoneInputHandle } from "./PhoneInput";
import BoxtalRelayMap, { type RelayPoint, type RelaySearchParams } from "./BoxtalRelayMap";
import PrinterLoaderIcon from "./PrinterLoaderIcon";
import QuoteCta from "./QuoteCta";

// UE-27 (pas le Royaume-Uni, sorti de l'UE) — France en tête puisque c'est le
// choix par défaut. Boxtal choisit lui-même les bons codes d'offre selon ce
// pays (voir server/src/lib/boxtal.ts).
const EU_COUNTRIES = [
  { code: "FR", label: "France" },
  { code: "DE", label: "Allemagne" },
  { code: "AT", label: "Autriche" },
  { code: "BE", label: "Belgique" },
  { code: "BG", label: "Bulgarie" },
  { code: "CY", label: "Chypre" },
  { code: "HR", label: "Croatie" },
  { code: "DK", label: "Danemark" },
  { code: "ES", label: "Espagne" },
  { code: "EE", label: "Estonie" },
  { code: "FI", label: "Finlande" },
  { code: "GR", label: "Grèce" },
  { code: "HU", label: "Hongrie" },
  { code: "IE", label: "Irlande" },
  { code: "IT", label: "Italie" },
  { code: "LV", label: "Lettonie" },
  { code: "LT", label: "Lituanie" },
  { code: "LU", label: "Luxembourg" },
  { code: "MT", label: "Malte" },
  { code: "NL", label: "Pays-Bas" },
  { code: "PL", label: "Pologne" },
  { code: "PT", label: "Portugal" },
  { code: "RO", label: "Roumanie" },
  { code: "SK", label: "Slovaquie" },
  { code: "SI", label: "Slovénie" },
  { code: "SE", label: "Suède" },
  { code: "CZ", label: "Tchéquie" },
];

interface AddressSuggestion {
  displayLabel: string;
  address: string;
  city: string;
  postcode: string;
  hasNumber: boolean;
}

function fmtDeliveryDate(isoStr: string) {
  return new Date(isoStr + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function eur(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function CartPage() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const { cart, loaded, incQty, decQty, removeItem } = useCart();

  const [step, setStep] = useState<"cart" | "checkout">("cart");
  const [deliveryMode, setDeliveryMode] = useState<"PICKUP" | "SHIPPING" | null>(null);
  const [shipName, setShipName] = useState("");
  const [shipAddress, setShipAddress] = useState("");
  const [shipCity, setShipCity] = useState("");
  const [shipZipcode, setShipZipcode] = useState("");
  const [shipCountry, setShipCountry] = useState("FR");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [ratesState, setRatesState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [rates, setRates] = useState<{ relay?: { cents: number; estimatedDeliveryDate?: string }; home?: { cents: number; estimatedDeliveryDate?: string } } | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [shipMode, setShipMode] = useState<"RELAY" | "HOME" | null>(null);
  const [relayPoint, setRelayPoint] = useState<RelayPoint | null>(null);
  const [relayMapNotice, setRelayMapNotice] = useState<string | null>(null);
  const [checkoutState, setCheckoutState] = useState<"idle" | "redirecting">("idle");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderPlacedPopup, setOrderPlacedPopup] = useState(false);
  const [dailyLimitPopup, setDailyLimitPopup] = useState(false);
  const [phoneActivityTick, setPhoneActivityTick] = useState(0);

  const phoneRef = useRef<PhoneInputHandle>(null);
  const addressFocusedRef = useRef(false);
  const addressSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideSuggestionsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function goToCheckout() {
    if (!isLoggedIn || cart.lines.length === 0) return;
    setStep("checkout");
  }

  // Landed here via useAccount.ts's redirectBackToCartIfNeeded() (the
  // cart's "Se connecter" button, which sent the visitor to /compte with
  // ?next=panier specifically to place an order) — go straight to the
  // checkout step instead of stopping at the cart summary, so logging in
  // doesn't cost an extra manual "Passer la commande" click.
  useEffect(() => {
    if (!isLoggedIn || !loaded || cart.lines.length === 0) return;
    if (new URLSearchParams(window.location.search).get("autocheckout") !== "1") return;
    window.history.replaceState({}, "", "/panier");
    setStep("checkout");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, loaded, cart.lines.length]);
  function backToCart() {
    setStep("cart");
  }

  function selectPickup() {
    setDeliveryMode("PICKUP");
    setRates(null);
    setRatesState("idle");
    setShipMode(null);
    setRelayPoint(null);
    setShippingError(null);
  }
  function selectShipping() {
    setDeliveryMode("SHIPPING");
  }

  function invalidateRates() {
    setRates(null);
    setRatesState("idle");
    setShipMode(null);
    setRelayPoint(null);
    setShippingError(null);
  }

  function searchAddress(query: string) {
    if (addressSearchTimerRef.current) clearTimeout(addressSearchTimerRef.current);
    if (query.trim().length < 4) {
      setAddressSuggestions([]);
      return;
    }
    addressSearchTimerRef.current = setTimeout(async () => {
      try {
        const url = "https://photon.komoot.io/api/?limit=5&lang=fr&q=" + encodeURIComponent(query) + "&osm_tag=place&osm_tag=building&osm_tag=highway";
        const res = await fetch(url);
        const data = await res.json();
        if (!addressFocusedRef.current) return;
        const features = data?.features || [];
        const suggestions: AddressSuggestion[] = features
          .map((f: { properties: Record<string, string> }) => {
            const p = f.properties;
            const hasNumber = !!p.housenumber;
            const address = [p.housenumber, p.street || p.name].filter(Boolean).join(" ");
            const displayLabel = [address, p.postcode, p.city].filter(Boolean).join(" ") + (hasNumber ? "" : " (sans numéro)");
            return { displayLabel, address, city: p.city || "", postcode: p.postcode || "", hasNumber };
          })
          .filter((s: AddressSuggestion) => s.address)
          .sort((a: AddressSuggestion, b: AddressSuggestion) => (b.hasNumber ? 1 : 0) - (a.hasNumber ? 1 : 0));
        setAddressSuggestions(suggestions);
      } catch {
        // network hiccup — leave suggestions as they were
      }
    }, 300);
  }

  function selectAddressSuggestion(s: AddressSuggestion) {
    if (addressSearchTimerRef.current) clearTimeout(addressSearchTimerRef.current);
    setShipAddress(s.address);
    setShipCity(s.city);
    setShipZipcode(s.postcode);
    setAddressSuggestions([]);
    invalidateRates();
  }

  function onAddressFocus() {
    addressFocusedRef.current = true;
  }
  function onAddressBlur() {
    addressFocusedRef.current = false;
    if (hideSuggestionsTimerRef.current) clearTimeout(hideSuggestionsTimerRef.current);
    hideSuggestionsTimerRef.current = setTimeout(() => setAddressSuggestions([]), 150);
  }

  async function quoteShipping() {
    if (!shipName.trim() || !shipAddress.trim() || !shipCity.trim() || !shipZipcode.trim()) {
      setShippingError("Renseignez le nom, téléphone, adresse, code postal et ville.");
      return;
    }
    if (!phoneRef.current?.isValidNumber()) {
      setShippingError("Numéro de téléphone invalide.");
      return;
    }
    setRatesState("loading");
    setShippingError(null);
    setShipMode(null);
    setRelayPoint(null);
    const res = await api.getShippingRates({ address: shipAddress, city: shipCity, zipcode: shipZipcode, country: shipCountry });
    if (!res.ok || !res.data) {
      const messages: Record<string, string> = {
        empty_cart: "Votre panier est vide.",
        shipping_not_configured: "La livraison n'est pas encore configurée, réessayez plus tard.",
        shipping_provider_error: "Le calcul des frais de livraison a échoué, réessayez.",
        no_offer_available: "Aucune offre de livraison disponible pour cette adresse.",
      };
      const errKey = (res.data as { error?: string } | null)?.error;
      setRatesState("error");
      setShippingError((errKey && messages[errKey]) || "Le calcul des frais de livraison a échoué.");
      return;
    }
    setRatesState("ready");
    setRates(res.data as typeof rates);
  }

  function selectHomeDelivery() {
    if (!rates?.home) return;
    setShipMode("HOME");
  }
  async function selectRelay() {
    if (!rates?.relay) return;
    setShipMode("RELAY");
  }

  const relaySearchParams: RelaySearchParams | null = shipMode === "RELAY" ? { country: shipCountry, zipCode: shipZipcode, city: shipCity, street: shipAddress } : null;

  async function startCheckout() {
    if (!isLoggedIn) return;
    if (!phoneRef.current?.isValidNumber()) return;
    if (deliveryMode === "PICKUP") {
      if (!shipName.trim()) return;
    } else {
      if (!shipMode || (shipMode === "RELAY" && !relayPoint)) return;
    }
    setCheckoutState("redirecting");
    setCheckoutError(null);
    const phone = phoneRef.current.getNumber();
    const shipping =
      deliveryMode === "PICKUP"
        ? { mode: "PICKUP", recipient: { name: shipName, phone } }
        : {
            mode: shipMode,
            recipient: { name: shipName, phone, address: shipAddress, city: shipCity, zipcode: shipZipcode, country: shipCountry },
            relayPoint: shipMode === "RELAY" ? relayPoint : undefined,
          };
    const res = await api.checkout(shipping);
    const data = res.data as { ok?: boolean; error?: string } | null;
    if (!res.ok || !data || !data.ok) {
      if (data?.error === "daily_limit_reached") {
        setCheckoutState("idle");
        setDailyLimitPopup(true);
        return;
      }
      const messages: Record<string, string> = {
        empty_cart: "Votre panier est vide.",
        missing_relay_point: "Choisissez un point relais avant de commander.",
        shipping_not_configured: "La livraison n'est pas encore configurée, réessayez plus tard.",
        shipping_provider_error: "Le calcul des frais de livraison a échoué, réessayez.",
        shipping_offer_unavailable: "Cette offre de livraison n'est plus disponible, recalculez les frais.",
      };
      setCheckoutState("idle");
      setCheckoutError((data?.error && messages[data.error]) || "La commande n'a pas pu être envoyée, réessayez.");
      return;
    }
    setCheckoutState("idle");
    setOrderPlacedPopup(true);
  }

  // --- Derived values (mirrors renderVals()) ---
  const subtotal = cart.subtotalCents / 100;
  const discountAmount = cart.discountCents / 100;
  const totalNoShipping = cart.totalCents / 100;
  const selectedRate = shipMode === "RELAY" ? rates?.relay : shipMode === "HOME" ? rates?.home : null;
  const shippingCents = selectedRate?.cents ?? 0;
  const total = (cart.totalCents + shippingCents) / 100;
  const isPickup = deliveryMode === "PICKUP";
  const isShipping = deliveryMode === "SHIPPING";
  const phoneValid = phoneRef.current?.isValidNumber() ?? false;
  void phoneActivityTick; // forces a re-render on widget input/countrychange so phoneValid above is re-read
  const shippingReady = isPickup ? !!shipName.trim() && phoneValid : phoneValid && !!shipMode && (shipMode !== "RELAY" || !!relayPoint);
  const canCheckout = isLoggedIn && cart.lines.length > 0 && !!deliveryMode && shippingReady;
  const hasItems = cart.lines.length > 0;
  const isStepCart = hasItems && step === "cart";
  const isStepCheckout = hasItems && step === "checkout";
  const isEmpty = loaded && cart.lines.length === 0;
  const needsLogin = !authLoading && !isLoggedIn;

  function optionStyle(selected: boolean) {
    return {
      display: "flex",
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      padding: "10px 12px",
      borderRadius: "7px",
      cursor: "pointer" as const,
      border: selected ? "1px solid #ff5a3c" : "1px solid rgba(255,255,255,.15)",
      background: selected ? "rgba(255,90,60,.1)" : "transparent",
      font: "600 11.5px 'Inter',sans-serif",
      color: selected ? "#ff5a3c" : "#e8e6e1",
    };
  }

  return (
    <div className="cart-page">
      <div className="hero">
        <div className="kicker">{isStepCheckout ? "Commande" : "Panier"}</div>
        <div className="hero-title">
          {isStepCheckout ? "Finaliser la commande" : cart.lines.length ? `${cart.lines.length} article${cart.lines.length > 1 ? "s" : ""}` : "Panier"}
        </div>
      </div>

      {isEmpty && (
        <div className="empty-wrap">
          <div className="empty-box">
            <div className="empty-title">Votre panier est vide</div>
            <div className="empty-text">Lancez un devis instantané pour ajouter une pièce.</div>
            <QuoteCta className="empty-cta" label="Obtenir un devis instantané" />
          </div>
        </div>
      )}

      {isStepCart && (
        <div className="cart-grid">
          <div className="lines-col">
            {cart.lines.map((item: CartLine) => (
              <div key={item.id} className="line-card">
                <div className="line-thumb-slot">
                  <CartLineThumbnail quoteJobId={item.quoteJobId} colorHex={item.colorHex || "#ff5a3c"} />
                </div>
                <div>
                  <div className="line-filename">{item.fileName}</div>
                  <div className="line-meta">
                    <span className="line-color-dot" style={{ background: item.colorHex || "#ff5a3c" }} />
                    <span>
                      {item.material} · {item.colorName} · remplissage {item.infillPct}% · qualité {item.quality}
                    </span>
                  </div>
                  <div className="line-qty-row">
                    <span className="qty-btn" onClick={() => decQty(item.id, item.qty)}>
                      –
                    </span>
                    <span className="qty-value">{item.qty}</span>
                    <span
                      className={`qty-btn${item.qty >= MAX_LINE_QTY ? " qty-btn-disabled" : ""}`}
                      onClick={() => incQty(item.id, item.qty)}
                      title={item.qty >= MAX_LINE_QTY ? `${MAX_LINE_QTY} pièces maximum` : undefined}
                    >
                      +
                    </span>
                    {item.discountPct > 0 && <span className="discount-chip">−{item.discountPct}%</span>}
                  </div>
                </div>
                <div className="line-right">
                  <div className="line-total">{eur(item.lineTotalCents)} €</div>
                  <div className="line-remove" onClick={() => removeItem(item.id)}>
                    Retirer
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="summary-card">
            <div className="summary-title">Résumé</div>
            <div className="summary-row">
              <span>Sous-total</span>
              <span>{subtotal.toFixed(2)} €</span>
            </div>
            {discountAmount > 0.001 && (
              <div className="summary-row accent">
                <span>Remise quantité</span>
                <span>−{discountAmount.toFixed(2)} €</span>
              </div>
            )}
            {cart.smallOrderFeeCents > 0 && (
              <div className="summary-row">
                <span>Frais petite commande</span>
                <span>+{eur(cart.smallOrderFeeCents)} €</span>
              </div>
            )}
            <div className="summary-total">
              <span>Total HT</span>
              <span>{totalNoShipping.toFixed(2)} €</span>
            </div>
            {cart.smallOrderFeeCents > 0 && <div className="summary-note">En dessous de {eur(cart.minOrderCents)} €, des frais s'appliquent — ajoutez des pièces pour les éviter.</div>}
            <div className="summary-cta">
              {needsLogin && (
                <a href="/compte?next=panier" className="cta-primary">
                  Se connecter
                </a>
              )}
              {!authLoading && isLoggedIn && (
                <div className="cta-primary" onClick={goToCheckout}>
                  Passer la commande
                </div>
              )}
            </div>
            <div className="summary-footnote">Livraison ou retrait à choisir à l'étape suivante</div>
          </div>
        </div>
      )}

      {isStepCheckout && (
        <div className="checkout-col">
          <div>
            <div className="back-link" onClick={backToCart}>
              ← Modifier le panier
            </div>
            <div className="mini-lines">
              {cart.lines.map((item: CartLine) => (
                <div key={item.id} className="mini-line-card">
                  <div className="mini-thumb-slot">
                    <CartLineThumbnail quoteJobId={item.quoteJobId} colorHex={item.colorHex || "#ff5a3c"} />
                  </div>
                  <div>
                    <div className="mini-filename">{item.fileName}</div>
                    <div className="mini-meta">
                      <span className="line-color-dot small" style={{ background: item.colorHex || "#ff5a3c" }} />
                      <span>
                        {item.material} · {item.colorName} · qté {item.qty}
                      </span>
                    </div>
                  </div>
                  <div className="mini-total">{eur(item.lineTotalCents)} €</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">Livraison</div>
            <div className="delivery-options">
              <div onClick={selectPickup} style={optionStyle(isPickup)}>
                <span>Retrait à l'atelier</span>
                <span>Gratuit</span>
              </div>
              <div onClick={selectShipping} style={optionStyle(isShipping)}>
                <span>Expédition</span>
                <span>À calculer</span>
              </div>
            </div>

            {isPickup && (
              <>
                <div className="pickup-note">
                  Vous récupérez la commande directement à l'atelier, sur rendez-vous : <strong className="highlight">29 rue Mellier, 44100 Nantes</strong>. Dès que votre pièce est prête, nous vous
                  appelons pour convenir d'un horaire.
                </div>
                <div className="ship-fields">
                  <input value={shipName} onChange={(e) => setShipName(e.target.value)} type="text" placeholder="Nom et prénom" className="field-input" />
                  <PhoneInput ref={phoneRef} onActivity={() => setPhoneActivityTick((n) => n + 1)} />
                </div>
              </>
            )}

            {isShipping && (
              <>
                <div className="ship-fields" style={{ marginBottom: "12px" }}>
                  <input value={shipName} onChange={(e) => setShipName(e.target.value)} type="text" placeholder="Nom et prénom" className="field-input" />
                  <PhoneInput ref={phoneRef} onActivity={() => setPhoneActivityTick((n) => n + 1)} />
                  <div style={{ position: "relative" }}>
                    <input
                      value={shipAddress}
                      onChange={(e) => {
                        setShipAddress(e.target.value);
                        invalidateRates();
                        searchAddress(e.target.value);
                      }}
                      onFocus={onAddressFocus}
                      onBlur={onAddressBlur}
                      type="text"
                      placeholder="Adresse"
                      autoComplete="off"
                      className="field-input"
                    />
                    {addressSuggestions.length > 0 && (
                      <div className="address-suggestions">
                        {addressSuggestions.map((sugg, i) => (
                          <div key={sugg.displayLabel + i} onMouseDown={() => selectAddressSuggestion(sugg)} className="address-suggestion">
                            {sugg.displayLabel}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      value={shipZipcode}
                      onChange={(e) => {
                        setShipZipcode(e.target.value);
                        invalidateRates();
                      }}
                      type="text"
                      placeholder="Code postal"
                      className="field-input"
                      style={{ width: "110px" }}
                    />
                    <input
                      value={shipCity}
                      onChange={(e) => {
                        setShipCity(e.target.value);
                        invalidateRates();
                      }}
                      type="text"
                      placeholder="Ville"
                      className="field-input"
                      style={{ flex: 1, minWidth: 0 }}
                    />
                  </div>
                  <select
                    value={shipCountry}
                    onChange={(e) => {
                      setShipCountry(e.target.value);
                      invalidateRates();
                    }}
                    className="field-input"
                  >
                    {EU_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div onClick={quoteShipping} className="quote-shipping-btn">
                  {ratesState === "loading" ? "Calcul en cours…" : "Calculer les frais de livraison"}
                </div>

                {shippingError && <div className="error-msg" style={{ marginTop: "10px" }}>{shippingError}</div>}

                {ratesState === "ready" && rates && (
                  <div className="rate-options">
                    {rates.relay && (
                      <>
                        <div onClick={selectRelay} style={optionStyle(shipMode === "RELAY")}>
                          <span>Point Relais (Mondial Relay)</span>
                          <span>{eur(rates.relay.cents)} €</span>
                        </div>
                        {rates.relay.estimatedDeliveryDate && <div className="delivery-date">Livraison estimée le {fmtDeliveryDate(rates.relay.estimatedDeliveryDate)}</div>}
                      </>
                    )}
                    {rates.home && (
                      <>
                        <div onClick={selectHomeDelivery} style={optionStyle(shipMode === "HOME")}>
                          <span>Livraison à domicile (Colissimo)</span>
                          <span>{eur(rates.home.cents)} €</span>
                        </div>
                        {rates.home.estimatedDeliveryDate && <div className="delivery-date">Livraison estimée le {fmtDeliveryDate(rates.home.estimatedDeliveryDate)}</div>}
                      </>
                    )}
                  </div>
                )}

                {ratesState === "ready" && rates && (
                  <div style={{ height: shipMode === "RELAY" ? "auto" : "0px", overflow: shipMode === "RELAY" ? "visible" : "hidden" }}>
                    <div className="relay-picker-title">Choisissez votre point relais</div>
                    {relayPoint && (
                      <div className="relay-summary">
                        {relayPoint.name} — {relayPoint.address}, {relayPoint.zipcode} {relayPoint.city}
                      </div>
                    )}
                    {relayMapNotice && <div className="relay-notice">{relayMapNotice}</div>}
                    <BoxtalRelayMap searchParams={relaySearchParams} onPointSelected={setRelayPoint} onNotice={setRelayMapNotice} />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="panel">
            <div className="panel-title">Récapitulatif</div>
            <div className="summary-row">
              <span>Sous-total</span>
              <span>{subtotal.toFixed(2)} €</span>
            </div>
            {discountAmount > 0.001 && (
              <div className="summary-row accent">
                <span>Remise quantité</span>
                <span>−{discountAmount.toFixed(2)} €</span>
              </div>
            )}
            {cart.smallOrderFeeCents > 0 && (
              <div className="summary-row">
                <span>Frais petite commande</span>
                <span>+{eur(cart.smallOrderFeeCents)} €</span>
              </div>
            )}
            {(!!selectedRate || isPickup) && (
              <div className="summary-row">
                <span>Livraison</span>
                <span>{isPickup ? "Gratuit" : selectedRate ? "+" + eur(selectedRate.cents) + " €" : ""}</span>
              </div>
            )}
            <div className="summary-total">
              <span>Total HT</span>
              <span>{total.toFixed(2)} €</span>
            </div>
            {cart.smallOrderFeeCents > 0 && <div className="summary-note">En dessous de {eur(cart.minOrderCents)} €, des frais s'appliquent — ajoutez des pièces pour les éviter.</div>}

            {checkoutError && <div className="error-msg" style={{ marginTop: "16px", textAlign: "center" }}>{checkoutError}</div>}

            {needsLogin && (
              <a href="/compte" className="cta-stripe">
                Se connecter pour commander
              </a>
            )}
            {checkoutState === "idle" && !needsLogin && (
              <div className="cta-checkout" style={{ background: canCheckout ? "#635bff" : "#3a3936", color: canCheckout ? "#fff" : "rgba(255,255,255,.4)", cursor: canCheckout ? "pointer" : "not-allowed" }} onClick={startCheckout}>
                <span>Passer la commande pour expertise</span>
              </div>
            )}
            {checkoutState === "redirecting" && (
              <div className="cta-redirecting">
                <span className="loader-icon-tiny" style={{ ["--pl-nozzle-fill" as string]: "#635bff" }}>
                  <PrinterLoaderIcon maskId="plMaskCartCheckout" />
                </span>
                <span>Envoi de la commande…</span>
              </div>
            )}
            <div className="summary-footnote">Aucun paiement à cette étape — réglé une fois la commande acceptée</div>
          </div>
        </div>
      )}

      {orderPlacedPopup && (
        <div className="popup-backdrop">
          <div className="popup-modal">
            <div className="popup-title">Commande envoyée !</div>
            <div className="popup-text">Votre commande est en expertise : nous vérifions qu'elle peut être réalisée telle quelle (24 à 48h maximum). Vous serez averti par email dès qu'elle sera acceptée et payable — ou revenez consulter votre compte d'ici là.</div>
            <div className="popup-btn" onClick={() => (window.location.href = "/compte")}>
              Compris !
            </div>
          </div>
        </div>
      )}

      {dailyLimitPopup && (
        <div className="popup-backdrop">
          <div className="popup-modal">
            <div className="popup-title">Surchauffe à l'atelier !</div>
            <div className="popup-text">Les lignes de production sont complètes pour aujourd'hui. On laisse refroidir les moteurs et réessayez à partir de 00h00.</div>
            <div className="popup-btn" onClick={() => setDailyLimitPopup(false)}>
              Compris !
            </div>
          </div>
        </div>
      )}

      <style>{`
        .hero { padding: 48px 24px 24px; max-width: 900px; margin: 0 auto; }
        .kicker { font: 600 12px 'Inter',sans-serif; letter-spacing: 1.2px; color: #ff5a3c; text-transform: uppercase; margin-bottom: 10px; }
        .hero-title { font: 700 30px/1.15 'Space Grotesk',sans-serif; color: #f3f1ec; }
        .empty-wrap { max-width: 900px; margin: 0 auto; padding: 0 24px 60px; text-align: center; }
        .empty-box { border: 1px solid rgba(255,255,255,.1); border-radius: 12px; background: #1a1917; padding: 50px 24px; }
        .empty-title { font: 600 14px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 8px; }
        .empty-text { font: 400 11.5px/1.6 'Inter',sans-serif; color: rgba(255,255,255,.5); margin-bottom: 18px; }
        .empty-cta, .empty-cta:hover { text-decoration: none; color: #161514; }
        .empty-cta { display: inline-block; background: #ff5a3c; font: 600 12px 'Inter',sans-serif; padding: 10px 18px; border-radius: 6px; }

        .cart-grid { max-width: 900px; margin: 0 auto; padding: 0 24px 60px; display: grid; grid-template-columns: 1.5fr 1fr; gap: 32px; align-items: start; }
        .lines-col { display: flex; flex-direction: column; gap: 12px; }
        .line-card { border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: #1a1917; padding: 14px; display: grid; grid-template-columns: 96px 1fr auto; gap: 14px; align-items: center; }
        .line-thumb-slot { width: 96px; height: 96px; }
        .line-filename { font: 600 13px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .line-meta { display: flex; align-items: center; gap: 6px; font: 400 10.5px 'Inter',sans-serif; color: rgba(255,255,255,.5); margin-bottom: 8px; }
        .line-color-dot { flex: none; width: 10px; height: 10px; border-radius: 50%; border: 1px solid rgba(255,255,255,.25); }
        .line-color-dot.small { width: 9px; height: 9px; }
        .line-qty-row { display: flex; align-items: center; gap: 8px; }
        .qty-btn { width: 20px; height: 20px; border: 1px solid rgba(255,255,255,.25); border-radius: 5px; text-align: center; line-height: 18px; font: 12px 'Inter',sans-serif; color: #e8e6e1; cursor: pointer; }
        .qty-btn-disabled { opacity: .35; cursor: not-allowed; }
        .qty-value { font: 600 12px 'Inter',sans-serif; color: #f3f1ec; min-width: 16px; text-align: center; }
        .discount-chip { font: 700 9px 'Inter',sans-serif; color: #ff5a3c; background: rgba(255,90,60,.12); border-radius: 4px; padding: 2px 6px; }
        .line-right { text-align: right; }
        .line-total { font: 700 15px 'Space Grotesk',sans-serif; color: #ff5a3c; margin-bottom: 8px; }
        .line-remove { font: 500 10.5px 'Inter',sans-serif; color: rgba(255,255,255,.4); cursor: pointer; }

        .summary-card { position: sticky; top: 20px; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; background: #1a1917; padding: 22px; }
        .summary-title, .panel-title { font: 700 15px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 16px; }
        .summary-row { display: flex; justify-content: space-between; font: 400 11.5px 'Inter',sans-serif; color: rgba(255,255,255,.55); margin-bottom: 8px; }
        .summary-row.accent { font-weight: 600; color: #ff5a3c; }
        .summary-total { display: flex; justify-content: space-between; font: 700 17px 'Space Grotesk',sans-serif; color: #f3f1ec; padding-top: 12px; margin-top: 8px; border-top: 1px solid rgba(255,255,255,.1); }
        .summary-note { font: 400 10px/1.5 'Inter',sans-serif; color: rgba(255,255,255,.4); margin-top: 8px; }
        .summary-cta { margin-top: 18px; }
        .cta-primary, .cta-primary:hover { text-decoration: none; color: #161514; }
        .cta-primary { display: flex; background: #ff5a3c; font: 600 12.5px 'Inter',sans-serif; padding: 12px; border-radius: 7px; text-align: center; align-items: center; justify-content: center; cursor: pointer; transition: transform .2s ease; }
        .cta-primary:hover { transform: scale(1.02); }
        .summary-footnote { font: 400 9.5px 'Inter',sans-serif; color: rgba(255,255,255,.35); margin-top: 10px; text-align: center; }

        .checkout-col { max-width: 900px; margin: 0 auto; padding: 0 24px 60px; display: flex; flex-direction: column; gap: 20px; }
        .back-link { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font: 600 11.5px 'Inter',sans-serif; color: rgba(255,255,255,.55); margin-bottom: 14px; }
        .mini-lines { display: flex; flex-direction: column; gap: 10px; }
        .mini-line-card { border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: #1a1917; padding: 12px 14px; display: grid; grid-template-columns: 60px 1fr auto; gap: 14px; align-items: center; }
        .mini-thumb-slot { width: 60px; height: 60px; }
        .mini-filename { font: 600 12.5px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mini-meta { display: flex; align-items: center; gap: 6px; font: 400 10.5px 'Inter',sans-serif; color: rgba(255,255,255,.5); }
        .mini-total { text-align: right; font: 700 13.5px 'Space Grotesk',sans-serif; color: #ff5a3c; }

        .panel { border: 1px solid rgba(255,255,255,.1); border-radius: 12px; background: #1a1917; padding: 22px; }
        .delivery-options { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
        .pickup-note { font: 400 11px/1.6 'Inter',sans-serif; color: rgba(255,255,255,.55); margin-bottom: 12px; }
        .highlight { color: #e8e6e1; }
        .ship-fields { display: flex; flex-direction: column; gap: 8px; }
        .field-input { width: 100%; box-sizing: border-box; height: 36px; border: 1px solid rgba(255,255,255,.15); border-radius: 6px; background: #161514; padding: 0 12px; font: 11.5px 'Inter',sans-serif; color: #e8e6e1; outline: none; }
        .address-suggestions { position: absolute; left: 0; right: 0; top: 38px; z-index: 20; background: #211f1c; border: 1px solid rgba(255,255,255,.15); border-radius: 6px; overflow: hidden; box-shadow: 0 8px 20px rgba(0,0,0,.35); }
        .address-suggestion { padding: 8px 12px; font: 400 11px 'Inter',sans-serif; color: #e8e6e1; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,.06); }
        .quote-shipping-btn { background: #ff5a3c; color: #161514; border: none; border-radius: 7px; padding: 10px; text-align: center; font: 600 11.5px 'Inter',sans-serif; cursor: pointer; transition: transform .2s ease; margin-top: 8px; }
        .quote-shipping-btn:hover { transform: scale(1.02); }
        .error-msg { font: 600 11px 'Inter',sans-serif; color: #ff8a70; }
        .rate-options { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
        .delivery-date { font: 400 10px 'Inter',sans-serif; color: rgba(255,255,255,.4); margin: -2px 2px 2px; }
        .relay-picker-title { font: 600 11px 'Inter',sans-serif; color: rgba(255,255,255,.6); margin: 14px 0 8px; }
        .relay-summary { font: 600 11.5px 'Inter',sans-serif; color: #ff5a3c; margin-bottom: 8px; }
        .relay-notice { font: 600 11px 'Inter',sans-serif; color: #ff8a70; margin-bottom: 8px; }

        .cta-stripe, .cta-stripe:hover { text-decoration: none; color: #fff; }
        .cta-stripe { display: flex; margin-top: 18px; background: #635bff; font: 600 13px 'Inter',sans-serif; padding: 12px; border-radius: 7px; text-align: center; align-items: center; justify-content: center; }
        .cta-checkout { margin-top: 18px; font: 600 13px 'Inter',sans-serif; padding: 12px; border-radius: 7px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .cta-redirecting { margin-top: 18px; background: #635bff; color: #fff; font: 600 13px 'Inter',sans-serif; padding: 12px; border-radius: 7px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px; opacity: .85; }
        .loader-icon-tiny { width: 11px; height: 11px; display: inline-block; color: #fff; }

        .popup-backdrop { position: fixed; inset: 0; background: rgba(10,10,10,.7); display: flex; align-items: center; justify-content: center; z-index: 50; animation: popupBackdropIn .2s ease; }
        .popup-modal { width: 380px; max-width: 90vw; background: #1a1917; border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: 26px; text-align: center; animation: popupModalIn .35s cubic-bezier(.2,.9,.3,1.1); }
        .popup-title { font: 700 16px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 10px; }
        .popup-text { font: 400 12px/1.6 'Inter',sans-serif; color: rgba(255,255,255,.65); margin-bottom: 20px; }
        .popup-btn { display: inline-block; background: #ff5a3c; color: #161514; font: 600 12.5px 'Inter',sans-serif; padding: 10px 22px; border-radius: 6px; cursor: pointer; }
        @keyframes popupBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popupModalIn { 0% { opacity: 0; transform: scale(.9) translateY(12px); } 70% { opacity: 1; transform: scale(1.02) translateY(0); } 100% { opacity: 1; transform: scale(1) translateY(0); } }

        /* intl-tel-input, restylé pour matcher les autres champs (voir les
           variables --iti-* déclarées par la lib elle-même). */
        .iti { display: block; width: 100%; --iti-border-color: rgba(255,255,255,.15); --iti-country-selector-bg: transparent; --iti-hover-color: rgba(255,255,255,.08); --iti-icon-color: rgba(255,255,255,.5); }
        .iti input.iti__tel-input { width: 100%; box-sizing: border-box; height: 36px; border: 1px solid rgba(255,255,255,.15); border-radius: 6px; background: #161514; font: 11.5px 'Inter',sans-serif; color: #e8e6e1; outline: none; }
        .iti__selected-dial-code { color: #e8e6e1; }
        .iti__country-list { background: #211f1c; border: 1px solid rgba(255,255,255,.15); color: #e8e6e1; border-radius: 6px; }
        .iti__country { color: #e8e6e1; }
        .iti__country.iti__highlight, .iti__country:hover { background: rgba(255,90,60,.12); }
        .iti__divider { border-bottom: 1px solid rgba(255,255,255,.1); }
        .iti__search-input { background: #161514; color: #e8e6e1; border: 1px solid rgba(255,255,255,.15); border-radius: 6px; }
        .iti__search-input::placeholder { color: rgba(255,255,255,.4); }

        @media (max-width: 900px) {
          .cart-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
