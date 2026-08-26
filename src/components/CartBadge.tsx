import { useCart } from "../hooks/useCart";

// The little count bubble on the header's cart icon — was hardcoded to "0"
// in Header.astro (a static Astro fragment can't reflect live cart state).
// A small island so only this number re-renders on 'nasap3d-cart-changed',
// not the whole header.
export default function CartBadge() {
  const { cart } = useCart();
  const count = cart.lines.reduce((n, l) => n + l.qty, 0);
  return <span className="cart-count">{count}</span>;
}
