import React, { useEffect, useState } from "react";
import api from "../api";
import { ParcelFeature } from "./MapView";

type ParcelFormProps = {
  parcel: ParcelFeature;
  onParcelUpdated: (p: ParcelFeature) => void;
};

export default function ParcelForm({ parcel, onParcelUpdated }: ParcelFormProps) {
  const [name, setName] = useState(parcel.name);
  const [culture, setCulture] = useState((parcel as any).culture || "");
  const [status, setStatus] = useState((parcel as any).status || "active");
  const [saving, setSaving] = useState(false);
  const [costPerHa, setCostPerHa] = useState<number | null>(null);
  const [yieldPerHa, setYieldPerHa] = useState<number | null>(null);

  useEffect(() => {
    setName(parcel.name);
    setCulture((parcel as any).culture || "");
    setStatus((parcel as any).status || "active");
  }, [parcel]);

  useEffect(() => {
    const loadReport = async () => {
      const [worksRes, harvestRes] = await Promise.all([
        api.get(`/parcels/${parcel.id}/works`),
        api.get("/harvests")
      ]);
      const works = worksRes.data.items || [];
      const harvests = (harvestRes.data || []).filter((h: any) => h.parcel_id === parcel.id);
      const totalCost = works.reduce((sum: number, w: any) => sum + (w.cost_total || 0), 0);
      const areaHa = (parcel.area_m2 || 0) / 10000;
      setCostPerHa(areaHa > 0 ? totalCost / areaHa : null);
      const latestHarvest = harvests.sort((a: any, b: any) => (a.date < b.date ? 1 : -1))[0];
      if (latestHarvest?.yield_t_per_ha) {
        setYieldPerHa(latestHarvest.yield_t_per_ha);
      } else if (latestHarvest?.qty_t && areaHa > 0) {
        setYieldPerHa(latestHarvest.qty_t / areaHa);
      } else {
        setYieldPerHa(null);
      }
    };
    loadReport();
  }, [parcel.id, parcel.area_m2]);

  const handleSave = async () => {
    setSaving(true);
    const res = await api.patch(`/parcels/${parcel.id}`, { name, culture, status });
    onParcelUpdated({ ...parcel, name, area_m2: res.data.area_m2 });
    setSaving(false);
  };

  return (
    <div>
      <div className="field">
        <label>Nume</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Cultura</label>
        <input value={culture} onChange={(e) => setCulture(e.target.value)} />
      </div>
      <div className="field">
        <label>Status</label>
        <input value={status} onChange={(e) => setStatus(e.target.value)} />
      </div>
      <button className="button" onClick={handleSave} disabled={saving}>Salveaza</button>
      <div className="small" style={{ marginTop: 8 }}>
        Suprafata curenta: {parcel.area_m2?.toFixed(0) || "-"} m2
      </div>
      <div className="small" style={{ marginTop: 6 }}>
        Cost/ha: {costPerHa ? costPerHa.toFixed(0) : "-"} · Productie/ha: {yieldPerHa ? yieldPerHa.toFixed(2) : "-"}
      </div>
    </div>
  );
}
