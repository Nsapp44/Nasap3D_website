import { useState } from "react";
import { useAdminOrders, type AdminOrder } from "../../hooks/useAdminOrders";
import OrderCard from "./OrderCard";

const FILTER_DEFS = [
  { key: "all", label: "Toutes" },
  { key: "EXPERTISE", label: "À expertiser" },
  { key: "AWAITING_PAYMENT", label: "Attente paiement" },
  { key: "PENDING", label: "Payée" },
  { key: "PRINTING", label: "En impression" },
  { key: "READY", label: "Expédié / Prêt" },
  { key: "DELIVERED", label: "Livré" },
  { key: "REJECTED", label: "Refusées" },
];

// customerNo (not clientEmail) is the grouping key — same client, same
// customerNo, always; email could in principle change (see account/email
// change flow) while customerNo never does. The email/n° client is then
// shown once per group instead of once per order card — was the same two
// lines repeated on every single order, which only added noise once a
// client has more than one order.
interface ClientGroup {
  customerNo: string;
  clientEmail: string;
  orders: AdminOrder[];
}
function groupOrdersByClient(orders: AdminOrder[]): ClientGroup[] {
  const groups = new Map<string, ClientGroup>();
  for (const order of orders) {
    let group = groups.get(order.customerNo);
    if (!group) {
      group = { customerNo: order.customerNo, clientEmail: order.clientEmail, orders: [] };
      groups.set(order.customerNo, group);
    }
    group.orders.push(order);
  }
  // Map preserves insertion order, and `orders` itself already comes back
  // most-recent-first (see useAdminOrders) — so groups end up ordered by
  // each client's own most recent order, not alphabetically or by group
  // size, matching the flat list's previous ordering as closely as grouping
  // allows.
  return Array.from(groups.values());
}

export default function OrdersTab() {
  const { orders, counts, filter, search, onSearchChange, setOrderFilter, reload } = useAdminOrders(true);
  const clientGroups = groupOrdersByClient(orders);
  // Which client groups have their full delivered history unfolded — starts
  // empty (collapsed) every time the tab loads, not persisted across
  // reloads/navigations; a purely local browsing convenience, not state
  // worth remembering.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  // An active search already narrows `orders` down server-side (see
  // useAdminOrders) to whatever actually matches the query — collapsing
  // anything further on top of that would only make the specific order
  // being searched for harder to find, not easier, so searching disables
  // the accordion entirely rather than requiring the admin to also expand
  // the right group by hand.
  const searching = search.trim().length > 0;

  function toggleGroup(customerNo: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(customerNo)) next.delete(customerNo);
      else next.add(customerNo);
      return next;
    });
  }

  return (
    <div className="orders-tab">
      <div className="eyebrow">Gestion des commandes</div>
      <div className="title">Commandes en cours</div>

      <div className="search-wrap">
        <input value={search} onChange={(e) => onSearchChange(e.target.value)} type="text" placeholder="Rechercher — n° de commande, email, n° client" className="search-input" />
      </div>

      <div className="filter-row">
        {FILTER_DEFS.map((f) => {
          const active = filter === f.key;
          return (
            <span key={f.key} onClick={() => setOrderFilter(f.key)} className={`filter-chip${active ? " active" : ""}`}>
              {f.label} <span className="filter-count">{counts[f.key] || 0}</span>
            </span>
          );
        })}
      </div>

      <div className="client-groups">
        {clientGroups.map((group) => {
          // Lightening only ever applies to DELIVERED orders — every other
          // status stays fully expanded, exactly as before this feature,
          // per explicit request: an order still in progress is exactly
          // what the admin needs to see at a glance, unlike a closed one.
          const activeOrders = group.orders.filter((o) => o.status !== "DELIVERED");
          const deliveredOrders = group.orders.filter((o) => o.status === "DELIVERED");
          // Nothing to fold with 0 or 1 delivered order — the accordion
          // would just be a control that does nothing.
          const collapsible = !searching && deliveredOrders.length > 1;
          const expanded = expandedGroups.has(group.customerNo);
          const visibleDelivered = collapsible && !expanded ? deliveredOrders.slice(0, 1) : deliveredOrders;
          const hiddenCount = deliveredOrders.length - visibleDelivered.length;

          return (
            <div key={group.customerNo} className="client-group">
              <div className="client-group-header">
                <span className="client-group-email">{group.clientEmail}</span>
                <span className="client-group-no">{group.customerNo}</span>
              </div>
              <div className="order-list">
                {activeOrders.map((order) => (
                  <OrderCard key={order.id} order={order} onChanged={reload} />
                ))}
                {visibleDelivered.map((order) => (
                  <OrderCard key={order.id} order={order} onChanged={reload} />
                ))}
              </div>
              {collapsible && (
                <div
                  onClick={() => toggleGroup(group.customerNo)}
                  className="btn-expand-row"
                  title={expanded ? "Réduire l'historique livré" : `Voir ${hiddenCount} commande${hiddenCount > 1 ? "s" : ""} livrée${hiddenCount > 1 ? "s" : ""} de plus`}
                >
                  <span className={`btn-expand${expanded ? " expanded" : ""}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {orders.length === 0 && <div className="empty-orders">Aucune commande à cette étape.</div>}
      </div>

      <style>{`
        .orders-tab { max-width: 1000px; margin: 0 auto; padding: 44px 24px 60px; }
        .eyebrow { font: 600 12px 'Inter',sans-serif; letter-spacing: 1.2px; color: #ff5a3c; text-transform: uppercase; margin-bottom: 10px; }
        .title { font: 700 26px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 18px; }
        .search-wrap { position: relative; margin-bottom: 14px; max-width: 340px; }
        .search-input { width: 100%; box-sizing: border-box; height: 38px; border: 1px solid rgba(255,255,255,.15); border-radius: 7px; background: #1a1917; padding: 0 12px; font: 12px 'Inter',sans-serif; color: #e8e6e1; outline: none; }
        .filter-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
        .filter-chip { display: inline-flex; align-items: center; gap: 6px; font: 600 11px 'Inter',sans-serif; padding: 7px 12px; border-radius: 7px; cursor: pointer; background: transparent; color: rgba(255,255,255,.6); border: 1px solid rgba(255,255,255,.15); }
        .filter-chip.active { background: #ff5a3c; color: #161514; border-color: #ff5a3c; }
        .filter-count { font: 700 9.5px 'Inter',sans-serif; padding: 1px 6px; border-radius: 20px; background: rgba(255,255,255,.1); color: rgba(255,255,255,.55); }
        .filter-chip.active .filter-count { background: rgba(22,21,20,.25); color: #161514; }
        .client-groups { display: flex; flex-direction: column; gap: 24px; }
        .client-group-header { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 0 2px 8px; border-bottom: 1px solid rgba(255,255,255,.08); margin-bottom: 12px; }
        .client-group-email { font: 600 12px 'Inter',sans-serif; color: rgba(255,255,255,.7); }
        .client-group-no { font: 500 10.5px ui-monospace,monospace; color: rgba(255,255,255,.35); }
        .order-list { display: flex; flex-direction: column; gap: 12px; }
        .btn-expand-row { display: flex; justify-content: center; padding: 8px 0 0; cursor: pointer; }
        .btn-expand { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid rgba(255,255,255,.15); color: rgba(255,255,255,.5); transition: transform .2s ease, border-color .2s ease, color .2s ease; }
        .btn-expand.expanded { transform: rotate(180deg); }
        .btn-expand-row:hover .btn-expand { border-color: rgba(255,90,60,.5); color: #ff8a70; }
        .empty-orders { border: 1px dashed rgba(255,255,255,.15); border-radius: 10px; padding: 34px; text-align: center; font: 500 12px 'Inter',sans-serif; color: rgba(255,255,255,.4); }

        .order-card { border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: #1a1917; padding: 18px 20px; }
        .btn-close { flex: none; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid rgba(255,255,255,.15); color: rgba(255,255,255,.45); cursor: pointer; }
        .btn-close:hover { border-color: rgba(255,90,60,.5); color: #ff8a70; background: rgba(255,90,60,.08); }
        .order-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .order-head-right { flex: none; display: flex; align-items: center; gap: 10px; }
        .order-title { font: 600 13px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 3px; }
        .order-desc { font: 400 10.5px 'Inter',sans-serif; color: rgba(255,255,255,.45); }
        .order-price { flex: none; font: 700 14px 'Space Grotesk',sans-serif; color: #ff5a3c; white-space: nowrap; }
        .order-status-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .status-chips { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
        .status-chip { font: 600 10px 'Inter',sans-serif; padding: 5px 10px; border-radius: 5px; cursor: pointer; background: transparent; color: rgba(255,255,255,.5); border: 1px solid rgba(255,255,255,.15); }
        .status-chip.active { background: #ff5a3c; color: #161514; border-color: #ff5a3c; }
        .status-chip.dim:not(.active) { color: rgba(255,255,255,.25); cursor: not-allowed; }
        .hint-text { font: 500 11px 'Inter',sans-serif; color: rgba(255,255,255,.45); }
        .hint-text.rejected { color: #ff8a70; }
        .btn-accept { background: #ff5a3c; color: #161514; font: 600 11px 'Inter',sans-serif; padding: 7px 14px; border-radius: 6px; cursor: pointer; }
        .btn-reject { border: 1px solid rgba(255,255,255,.2); color: #f3f1ec; font: 500 11px 'Inter',sans-serif; padding: 7px 14px; border-radius: 6px; cursor: pointer; }
        .order-section { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.08); }
        .file-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .file-row + .file-row { margin-top: 6px; }
        .file-label { font: 400 10.5px ui-monospace,monospace; color: rgba(255,255,255,.5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .btn-outline, .btn-outline:hover { text-decoration: none; color: #f3f1ec; }
        .btn-outline { border: 1px solid rgba(255,255,255,.2); font: 500 10px 'Inter',sans-serif; padding: 5px 10px; border-radius: 5px; cursor: pointer; display: inline-block; }
        .btn-outline.muted, .btn-outline.muted:hover { color: rgba(255,255,255,.6); }
        .btn-delete { border: 1px solid rgba(255,90,60,.35); color: #ff8a70; font: 500 10px 'Inter',sans-serif; padding: 5px 10px; border-radius: 5px; cursor: pointer; }
        .file-gone { font: 500 10px 'Inter',sans-serif; color: rgba(255,255,255,.3); }
        .section-label { font: 600 10px 'Inter',sans-serif; color: rgba(255,255,255,.5); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
        .section-text { font: 400 11px/1.6 'Inter',sans-serif; color: #e8e6e1; }
        .parcel-dims { margin-top: 8px; font: 600 10.5px ui-monospace,monospace; color: #f3f1ec; }
        .oversized-warning { margin-top: 8px; font: 600 10.5px 'Inter',sans-serif; color: #ff8a70; }
        .btn-label, .btn-label:hover { text-decoration: none; color: #ff5a3c; }
        .btn-label { display: inline-flex; align-items: center; gap: 6px; border: 1px solid rgba(255,90,60,.35); font: 600 10.5px 'Inter',sans-serif; padding: 6px 12px; border-radius: 5px; }
        .tracking-number { font: 600 10.5px ui-monospace,monospace; color: #e8e6e1; }
        .tracking-input { width: 180px; box-sizing: border-box; height: 28px; border: 1px solid rgba(255,255,255,.15); border-radius: 5px; background: #161514; padding: 0 8px; font: 10.5px ui-monospace,monospace; color: #e8e6e1; outline: none; }
        .btn-emergency { border: 1px dashed rgba(255,90,60,.5); color: #ff8a70; background: transparent; font: 500 10px 'Inter',sans-serif; padding: 5px 10px; border-radius: 5px; cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; }
        .btn-emergency:hover { background: rgba(255,90,60,.08); }
        .btn-next { border: 1px solid #ff5a3c; color: #ff5a3c; background: transparent; font: 600 10px 'Inter',sans-serif; padding: 5px 10px; border-radius: 5px; cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; }
        .btn-next:hover { background: rgba(255,90,60,.08); }
        .btn-next.is-busy, .btn-emergency.is-busy { opacity: .6; cursor: wait; }
        .status-chip.dim { cursor: not-allowed; }

        @media (max-width: 480px) {
          .order-head { flex-direction: column; align-items: flex-start; gap: 8px; }
          .order-head-right { align-self: flex-end; }
          .order-status-row { flex-direction: column; align-items: stretch; }
          .status-chips { gap: 5px; }
          .status-chip { flex: 1 1 auto; text-align: center; }
          .section-text { word-break: break-word; }
          .file-row { flex-wrap: wrap; }
          .tracking-input { width: 100%; }
        }
      `}</style>
    </div>
  );
}
