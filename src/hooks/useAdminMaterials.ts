import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api-client";

export interface AdminColor {
  id: string;
  colorName: string;
  colorHex: string;
  inStock: boolean;
}
export interface AdminMaterial {
  id: string;
  key: string;
  label: string;
  pricePerKgCents: number;
  colors: AdminColor[];
}

// Ported from Admin.dc.html's _loadMaterials/toggleSpool/savePrice.
export function useAdminMaterials(enabled: boolean) {
  const [materials, setMaterials] = useState<AdminMaterial[]>([]);

  const load = useCallback(async () => {
    const res = await api.adminGetMaterials();
    if (res.ok && res.data) setMaterials((res.data as { materials: AdminMaterial[] }).materials);
  }, []);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  async function toggleSpool(materialId: string, colorId: string, inStock: boolean) {
    await api.adminUpdateColorStock(materialId, colorId, !inStock);
    load();
  }

  async function savePrice(materialId: string, cents: number) {
    const res = await api.adminUpdateMaterialPrice(materialId, cents);
    if (res.ok) load();
    return res.ok;
  }

  return { materials, toggleSpool, savePrice };
}
