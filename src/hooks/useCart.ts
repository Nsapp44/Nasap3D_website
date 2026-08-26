import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api-client";

export interface CartLine {
  id: string;
  quoteJobId: string;
  fileName: string;
  material: string;
  infillPct: number;
  quality: string;
  qty: number;
  colorHex: string;
  colorName: string;
  discountPct: number;
  lineTotalCents: number;
}

export interface Cart {
  lines: CartLine[];
  subtotalCents: number;
  discountCents: number;
  smallOrderFeeCents: number;
  totalCents: number;
  minOrderCents: number;
}

const EMPTY_CART: Cart = { lines: [], subtotalCents: 0, discountCents: 0, smallOrderFeeCents: 0, totalCents: 0, minOrderCents: 2000 };

// Ported from Cart.dc.html's _loadCart/incQty/decQty/removeItem — same
// 'nasap3d-cart-changed' event (dispatched elsewhere, e.g. after adding an
// item from the quote wizard) keeps this in sync with changes made outside
// this component's own mutations.
export function useCart() {
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await api.getCart();
    if (res.ok && res.data) {
      setCart(res.data as Cart);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const listener = () => load();
    window.addEventListener("nasap3d-cart-changed", listener);
    return () => window.removeEventListener("nasap3d-cart-changed", listener);
  }, [load]);

  async function incQty(id: string, qty: number) {
    const res = await api.updateCartItem(id, qty + 1);
    if (res.ok) {
      setCart(res.data as Cart);
      window.dispatchEvent(new Event("nasap3d-cart-changed"));
    }
  }
  async function decQty(id: string, qty: number) {
    if (qty <= 1) return;
    const res = await api.updateCartItem(id, qty - 1);
    if (res.ok) {
      setCart(res.data as Cart);
      window.dispatchEvent(new Event("nasap3d-cart-changed"));
    }
  }
  async function removeItem(id: string) {
    const res = await api.removeCartItem(id);
    if (res.ok) {
      setCart(res.data as Cart);
      window.dispatchEvent(new Event("nasap3d-cart-changed"));
    }
  }

  return { cart, loaded, incQty, decQty, removeItem };
}
