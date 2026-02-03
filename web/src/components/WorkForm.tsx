import React, { useEffect, useState } from "react";
import api from "../api";

type Work = {
  id: number;
  type: string;
  date: string;
  depth_cm?: number;
  diesel_l_per_ha?: number;
  machine?: string;
  cost_total?: number;
};

type WorkFormProps = {
  parcelId: number;
};

export default function WorkForm({ parcelId }: WorkFormProps) {
  const [items, setItems] = useState<Work[]>([]);
  const [form, setForm] = useState({
    type: "disc",
    date: new Date().toISOString().slice(0, 10),
    depth_cm: "",
    diesel_l_per_ha: "",
    machine: "",
    cost_total: ""
  });

  const load = async () => {
    const res = await api.get(`/parcels/${parcelId}/works`);
    setItems(res.data.items || []);
  };

  useEffect(() => {
    load();
  }, [parcelId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/parcels/${parcelId}/works`, {
      type: form.type,
      date: form.date,
      depth_cm: form.depth_cm ? Number(form.depth_cm) : null,
      diesel_l_per_ha: form.diesel_l_per_ha ? Number(form.diesel_l_per_ha) : null,
      machine: form.machine,
      cost_total: form.cost_total ? Number(form.cost_total) : null
    });
    setForm({ ...form, depth_cm: "", diesel_l_per_ha: "", machine: "", cost_total: "" });
    load();
  };

  return (
    <div>
      <form onSubmit={submit}>
        <div className="field">
          <label>Tip lucrare</label>
          <input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
        </div>
        <div className="field">
          <label>Data</label>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div className="field">
          <label>Adancime (cm)</label>
          <input value={form.depth_cm} onChange={(e) => setForm({ ...form, depth_cm: e.target.value })} />
        </div>
        <div className="field">
          <label>Motorina (l/ha)</label>
          <input value={form.diesel_l_per_ha} onChange={(e) => setForm({ ...form, diesel_l_per_ha: e.target.value })} />
        </div>
        <div className="field">
          <label>Utilaj</label>
          <input value={form.machine} onChange={(e) => setForm({ ...form, machine: e.target.value })} />
        </div>
        <div className="field">
          <label>Cost total (lei)</label>
          <input value={form.cost_total} onChange={(e) => setForm({ ...form, cost_total: e.target.value })} />
        </div>
        <button className="button" type="submit">Adauga lucrare</button>
      </form>

      <div style={{ marginTop: 12 }} className="list">
        {items.map((w) => (
          <div className="list-item" key={w.id}>
            <strong>{w.type}</strong> · {w.date}
            <div className="small">Motorina: {w.diesel_l_per_ha || "-"} l/ha · Cost: {w.cost_total || "-"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
