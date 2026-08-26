import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api-client";

export interface AdminOrderItem {
  id: string;
  nameSnapshot: string;
  materialSnapshot: string;
  qty: number;
  fileName: string | null;
  fileAvailable: boolean;
}

export interface AdminOrder {
  id: string;
  ref: string;
  clientEmail: string;
  customerNo: string;
  createdAt: string;
  totalCents: number;
  status: string;
  items: AdminOrderItem[];
  canBuyLabel: boolean;
  shippingLabelUrl: string | null;
  shippingOversized: boolean;
  boxtalOrderRef: string | null;
  shippingMode: string | null;
  shippingLabel: string;
  shippingParcelLengthCm: number | null;
  shippingParcelWidthCm: number | null;
  shippingParcelHeightCm: number | null;
  shippingWeightG: number | null;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientAddress: string | null;
  recipientCity: string | null;
  recipientZipcode: string | null;
  recipientCountry: string | null;
  relayPointName: string | null;
  relayPointAddress: string | null;
  relayPointCity: string | null;
  relayPointZipcode: string | null;
  trackingNumber: string | null;
}

// Ported from Admin.dc.html's _loadOrders/onOrderSearchChange/setOrderFilter
// — same request-sequence guard against the search debounce racing a
// status-filter change (see the original's own comment on why).
export function useAdminOrders(enabled: boolean) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const loadSeqRef = useRef(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (statusFilter: string, searchText: string) => {
    const requestId = ++loadSeqRef.current;
    const res = await api.adminGetOrders(statusFilter === "all" ? undefined : statusFilter, searchText.trim());
    if (requestId !== loadSeqRef.current) return;
    if (res.ok && res.data) {
      const data = res.data as { orders: AdminOrder[]; counts: Record<string, number> };
      setOrders(data.orders);
      setCounts(data.counts);
    }
  }, []);

  useEffect(() => {
    if (enabled) load(filter, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on `enabled`/`filter` transitions; search changes go through the debounced path below
  }, [enabled, filter]);

  function onSearchChange(value: string) {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => load(filter, value), 300);
  }

  function setOrderFilter(key: string) {
    setFilter(key);
  }

  function reload() {
    load(filter, search);
  }

  return { orders, counts, filter, search, onSearchChange, setOrderFilter, reload };
}
