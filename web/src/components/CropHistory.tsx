import React, { useEffect, useState } from "react";
import api from "../api";

type Crop = { id: number; crop: string };

type Variety = { id: number; crop_id: number; variety: string };

type ParcelCrop = {
  id: number;
  season_year: number;
  crop_id: number;
  variety_id?: number;
  sowing_date?: string;
  harvest_date?: string;
  yield_t_per_ha?: number;
};

type CropHistoryProps = {
  parcelId: number;
};

export default function CropHistory({ parcelId }: CropHistoryProps) {
  const [items, setItems] = useState<ParcelCrop[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [form, setForm] = useState({
    season_year: new Date().getFullYear(),
    crop_id: "",
    variety_id: "",
    sowing_date: "",
    harvest_date: "",
    yield_t_per_ha: ""
  });

  const load = async () => {
    const res = await api.get(`/parcels/${parcelId}/crops`);
    setItems(res.data || []);
  };

  const loadCatalog = async () => {
    const cropsRes = await api.get("/catalog/crops");
    const varRes = await api.get("/catalog/varieties");
    setCrops(cropsRes.data || []);
    setVarieties(varRes.data || []);
  };

  useEffect(() => {
    load();
    loadCatalog();
  }, [parcelId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/parcels/${parcelId}/crops`, {
      season_year: Number(form.season_year),
      crop_id: Number(form.crop_id),
      variety_id: form.variety_id ? Number(form.variety_id) : null,
      sowing_date: form.sowing_date || null,
      harvest_date: form.harvest_date || null,
      yield_t_per_ha: form.yield_t_per_ha ? Number(form.yield_t_per_ha) : null
    });
    setForm({ ...form, variety_id: "", sowing_date: "", harvest_date: "", yield_t_per_ha: "" });
    load();
  };

  const filteredVar = varieties.filter((v) => String(v.crop_id) === String(form.crop_id));

  return (
    <div>
      <form onSubmit={submit}>
        <div className="field">
          <label>An sezon</label>
          <input value={form.season_year} onChange={(e) => setForm({ ...form, season_year: Number(e.target.value) })} />
        </div>
        <div className="field">
          <label>Cultura</label>
          <select value={form.crop_id} onChange={(e) => setForm({ ...form, crop_id: e.target.value })}>
            <option value="">Selecteaza</option>
            {crops.map((c) => (
              <option key={c.id} value={c.id}>{c.crop}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Soi</label>
          <select value={form.variety_id} onChange={(e) => setForm({ ...form, variety_id: e.target.value })}>
            <option value="">(optional)</option>
            {filteredVar.map((v) => (
              <option key={v.id} value={v.id}>{v.variety}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Data semanat</label>
          <input type="date" value={form.sowing_date} onChange={(e) => setForm({ ...form, sowing_date: e.target.value })} />
        </div>
        <div className="field">
          <label>Data recoltat</label>
          <input type="date" value={form.harvest_date} onChange={(e) => setForm({ ...form, harvest_date: e.target.value })} />
        </div>
        <div className="field">
          <label>Productie (t/ha)</label>
          <input value={form.yield_t_per_ha} onChange={(e) => setForm({ ...form, yield_t_per_ha: e.target.value })} />
        </div>
        <button className="button" type="submit">Adauga cultura</button>
      </form>

      <div style={{ marginTop: 12 }} className="list">
        {items.map((c) => (
          <div className="list-item" key={c.id}>
            <strong>{c.season_year}</strong> · {c.crop_id}
            <div className="small">Productie: {c.yield_t_per_ha || "-"} t/ha</div>
          </div>
        ))}
      </div>
    </div>
  );
}
