import React, { useEffect, useState } from "react";
import api from "../api";

type Soil = {
  id: number;
  parcel_id: number;
  date: string;
  ph?: number;
  N?: number;
  P?: number;
  K?: number;
  humus_pct?: number;
};

type SoilFormProps = {
  parcelId: number;
};

export default function SoilForm({ parcelId }: SoilFormProps) {
  const [items, setItems] = useState<Soil[]>([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    ph: "",
    N: "",
    P: "",
    K: "",
    humus_pct: ""
  });

  const load = async () => {
    const res = await api.get("/soil-analyses");
    const all = res.data || [];
    setItems(all.filter((s: Soil) => s.parcel_id === parcelId));
  };

  useEffect(() => {
    load();
  }, [parcelId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/soil-analyses", {
      parcel_id: parcelId,
      date: form.date,
      ph: form.ph ? Number(form.ph) : null,
      N: form.N ? Number(form.N) : null,
      P: form.P ? Number(form.P) : null,
      K: form.K ? Number(form.K) : null,
      humus_pct: form.humus_pct ? Number(form.humus_pct) : null
    });
    setForm({ ...form, ph: "", N: "", P: "", K: "", humus_pct: "" });
    load();
  };

  return (
    <div>
      <form onSubmit={submit}>
        <div className="field">
          <label>Data analiza</label>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div className="field">
          <label>pH</label>
          <input value={form.ph} onChange={(e) => setForm({ ...form, ph: e.target.value })} />
        </div>
        <div className="field">
          <label>N</label>
          <input value={form.N} onChange={(e) => setForm({ ...form, N: e.target.value })} />
        </div>
        <div className="field">
          <label>P</label>
          <input value={form.P} onChange={(e) => setForm({ ...form, P: e.target.value })} />
        </div>
        <div className="field">
          <label>K</label>
          <input value={form.K} onChange={(e) => setForm({ ...form, K: e.target.value })} />
        </div>
        <div className="field">
          <label>Humus %</label>
          <input value={form.humus_pct} onChange={(e) => setForm({ ...form, humus_pct: e.target.value })} />
        </div>
        <button className="button" type="submit">Adauga analiza</button>
      </form>

      <div style={{ marginTop: 12 }} className="list">
        {items.map((s) => (
          <div className="list-item" key={s.id}>
            <strong>{s.date}</strong> · pH {s.ph || "-"} · N {s.N || "-"} P {s.P || "-"} K {s.K || "-"}
          </div>
        ))}
      </div>
    </div>
  );
}
