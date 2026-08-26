import { useAdminOrders } from "../../hooks/useAdminOrders";
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

export default function OrdersTab() {
  const { orders, counts, filter, search, onSearchChange, setOrderFilter, reload } = useAdminOrders(true);

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

      <div className="order-list">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} onChanged={reload} />
        ))}
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
        .order-list { display: flex; flex-direction: column; gap: 12px; }
        .empty-orders { border: 1px dashed rgba(255,255,255,.15); border-radius: 10px; padding: 34px; text-align: center; font: 500 12px 'Inter',sans-serif; color: rgba(255,255,255,.4); }

        .order-card { border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: #1a1917; padding: 18px 20px; }
        .order-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .order-title { font: 600 13px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 3px; }
        .order-desc { font: 400 10.5px 'Inter',sans-serif; color: rgba(255,255,255,.45); }
        .order-customer-no { font: 400 9.5px ui-monospace,monospace; color: rgba(255,255,255,.3); margin-top: 2px; }
        .order-price { font: 700 14px 'Space Grotesk',sans-serif; color: #ff5a3c; }
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

        @media (max-width: 480px) {
          .order-status-row { flex-direction: column; align-items: stretch; }
        }
      `}</style>
    </div>
  );
}
