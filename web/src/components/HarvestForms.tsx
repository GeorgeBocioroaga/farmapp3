import React, { useEffect, useState } from "react";
import api from "../api";

type Harvest = {
  id: number;
  parcel_id: number;
  date: string;
  qty_t?: number;
  yield_t_per_ha?: number;
};

type HarvestFormsProps = {
  parcelId: number;
};

export default function HarvestForms({ parcelId }: HarvestFormsProps) {
  const [items, setItems] = useState<Harvest[]>([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    qty_t: "",
    yield_t_per_ha: ""
  });
  const [ticketResult, setTicketResult] = useState<any>(null);

  const load = async () => {
    const res = await api.get("/harvests");
    const all = res.data || [];
    setItems(all.filter((h: Harvest) => h.parcel_id === parcelId));
  };

  useEffect(() => {
    load();
  }, [parcelId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/harvests", {
      parcel_id: parcelId,
      date: form.date,
      qty_t: form.qty_t ? Number(form.qty_t) : null,
      yield_t_per_ha: form.yield_t_per_ha ? Number(form.yield_t_per_ha) : null
    });
    setForm({ ...form, qty_t: "", yield_t_per_ha: "" });
    load();
  };

  const handleTicket = async (harvestId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post(`/harvests/${harvestId}/ticket`, formData, { headers: { "Content-Type": "multipart/form-data" } });
    setTicketResult(res.data.parsed);
  };

  return (
    <div>
      <form onSubmit={submit}>
        <div className="field">
          <label>Data recoltare</label>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div className="field">
          <label>Cantitate (t)</label>
          <input value={form.qty_t} onChange={(e) => setForm({ ...form, qty_t: e.target.value })} />
        </div>
        <div className="field">
          <label>Productie (t/ha)</label>
          <input value={form.yield_t_per_ha} onChange={(e) => setForm({ ...form, yield_t_per_ha: e.target.value })} />
        </div>
        <button className="button" type="submit">Adauga recoltare</button>
      </form>

      <div style={{ marginTop: 12 }} className="list">
        {items.map((h) => (
          <div className="list-item" key={h.id}>
            <strong>{h.date}</strong> · {h.qty_t || "-"} t
            <div className="small">Productie: {h.yield_t_per_ha || "-"} t/ha</div>
            <div style={{ marginTop: 6 }}>
              <input type="file" onChange={(e) => e.target.files && handleTicket(h.id, e.target.files[0])} />
            </div>
          </div>
        ))}
      </div>

      {ticketResult && (
        <div className="notice" style={{ marginTop: 12 }}>
          <div className="small">OCR bon siloz:</div>
          {Object.entries(ticketResult.values || {}).map(([k, v]) => (
            <div key={k} className="small">{k}: {String(v)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
