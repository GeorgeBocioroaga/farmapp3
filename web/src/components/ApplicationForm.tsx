import React, { useEffect, useState } from "react";
import api from "../api";

const parseDecimal = (value: string) => {
  const cleaned = value.replace(",", ".").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
};

type MixItem = { product_id: number; dose_per_ha: number; uom: string };

type Mix = {
  id: number;
  name?: string;
  items: MixItem[];
};

type Product = {
  id: number;
  trade_name: string;
  product_type?: string;
};

type Application = {
  id: number;
  date: string;
  area_ha: number;
  total_cost?: number;
  status?: string;
};

type ApplicationFormProps = {
  parcelId: number;
};

export default function ApplicationForm({ parcelId }: ApplicationFormProps) {
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [mode, setMode] = useState<"mix" | "manual">("mix");
  const [mixId, setMixId] = useState<string>("");
  const [items, setItems] = useState<Array<{ product_id: string; dose_per_ha: string; uom: string }>>([
    { product_id: "", dose_per_ha: "", uom: "L/ha" }
  ]);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    area_ha: "",
    water_l_per_ha: "",
    tank_volume_l: "",
    machine: ""
  });
  const [mixForm, setMixForm] = useState({
    name: "",
    items: [{ product_id: "", dose_per_ha: "", uom: "L/ha" }]
  });
  const [compatResult, setCompatResult] = useState<any>(null);

  const load = async () => {
    const [mixRes, prodRes, appRes] = await Promise.all([
      api.get("/mix"),
      api.get("/inventory/items", { params: { kind: "chem" } }),
      api.get("/applications", { params: { parcel_id: parcelId } })
    ]);
    setMixes(mixRes.data || []);
    setProducts((prodRes.data || []).filter((p: Product) => p.product_type === "herbicide"));
    setApps(appRes.data || []);
  };

  useEffect(() => {
    load();
  }, [parcelId]);

  const addRow = () => {
    setItems((prev) => [...prev, { product_id: "", dose_per_ha: "", uom: "L/ha" }]);
  };

  const removeRow = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, key: string, value: string) => {
    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));
  };

  const addMixRow = () => {
    setMixForm((prev) => ({
      ...prev,
      items: [...prev.items, { product_id: "", dose_per_ha: "", uom: "L/ha" }]
    }));
  };

  const removeMixRow = (idx: number) => {
    setMixForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const updateMixRow = (idx: number, key: string, value: string) => {
    setMixForm((prev) => ({
      ...prev,
      items: prev.items.map((row, i) => (i === idx ? { ...row, [key]: value } : row))
    }));
  };

  const saveMix = async (e: React.FormEvent) => {
    e.preventDefault();
    const payloadItems = mixForm.items
      .map((row) => ({
        product_id: row.product_id ? Number(row.product_id) : 0,
        dose_per_ha: parseDecimal(row.dose_per_ha) || 0,
        uom: row.uom
      }))
      .filter((row) => row.product_id && row.dose_per_ha > 0);
    if (!payloadItems.length) return;
    await api.post("/mix", { name: mixForm.name || undefined, items: payloadItems });
    setMixForm({ name: "", items: [{ product_id: "", dose_per_ha: "", uom: "L/ha" }] });
    setCompatResult(null);
    load();
  };

  const checkCompat = async () => {
    const payloadItems = mixForm.items
      .map((row) => ({
        product_id: row.product_id ? Number(row.product_id) : 0,
        dose_per_ha: parseDecimal(row.dose_per_ha) || 0,
        uom: row.uom
      }))
      .filter((row) => row.product_id && row.dose_per_ha > 0);
    if (!payloadItems.length) return;
    const res = await api.post("/mix/check-items", payloadItems);
    setCompatResult(res.data);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const area = parseDecimal(form.area_ha);
    if (!area || area <= 0) return;

    let payloadItems: MixItem[] | undefined;
    if (mode === "manual") {
      payloadItems = items
        .map((row) => ({
          product_id: row.product_id ? Number(row.product_id) : 0,
          dose_per_ha: parseDecimal(row.dose_per_ha) || 0,
          uom: row.uom
        }))
        .filter((row) => row.product_id && row.dose_per_ha > 0);
      if (!payloadItems.length) return;
    }

    await api.post("/applications", {
      parcel_id: parcelId,
      date: form.date,
      area_ha: area,
      mix_id: mode === "mix" && mixId ? Number(mixId) : undefined,
      items: payloadItems,
      water_l_per_ha: parseDecimal(form.water_l_per_ha) || undefined,
      tank_volume_l: parseDecimal(form.tank_volume_l) || undefined,
      machine: form.machine || undefined
    });

    setForm({
      date: new Date().toISOString().slice(0, 10),
      area_ha: "",
      water_l_per_ha: "",
      tank_volume_l: "",
      machine: ""
    });
    setItems([{ product_id: "", dose_per_ha: "", uom: "L/ha" }]);
    setMixId("");
    load();
  };

  return (
    <div>
      <div className="panel" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Mixuri salvate</h3>
        <form onSubmit={saveMix}>
          <div className="field">
            <label>Nume mix</label>
            <input value={mixForm.name} onChange={(e) => setMixForm({ ...mixForm, name: e.target.value })} placeholder="Ex: erbicid postemergent" />
          </div>
          <div className="field">
            <label>Produse + doze</label>
            {mixForm.items.map((row, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, marginBottom: 8 }}>
                <select value={row.product_id} onChange={(e) => updateMixRow(idx, "product_id", e.target.value)}>
                  <option value="">Selecteaza produs</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.trade_name}</option>
                  ))}
                </select>
                <input value={row.dose_per_ha} onChange={(e) => updateMixRow(idx, "dose_per_ha", e.target.value)} placeholder="Ex: 1,5" />
                <select value={row.uom} onChange={(e) => updateMixRow(idx, "uom", e.target.value)}>
                  <option value="L/ha">L/ha</option>
                  <option value="kg/ha">kg/ha</option>
                </select>
                <button className="button ghost" type="button" onClick={() => removeMixRow(idx)}>-</button>
              </div>
            ))}
            <button className="button secondary" type="button" onClick={addMixRow}>Adauga produs</button>
          </div>
          <button className="button" type="submit">Salveaza mix</button>
          <button className="button secondary" type="button" onClick={checkCompat} style={{ marginLeft: 8 }}>Verifica compatibilitate</button>
        </form>
        {compatResult && (
          <div className="notice" style={{ marginTop: 10 }}>
            Verdict: {compatResult.summary}
          </div>
        )}
        <div style={{ marginTop: 12 }} className="list">
          {mixes.map((m) => (
            <div className="list-item" key={m.id}>
              <strong>{m.name || `Mix ${m.id}`}</strong>
              <div className="small">
                {m.items?.map((i, idx) => (
                  <span key={idx}>{products.find((p) => p.id === i.product_id)?.trade_name || `#${i.product_id}`} {i.dose_per_ha} {i.uom}{idx < (m.items?.length || 0) - 1 ? " · " : ""}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="tabs">
        <div className={`tab ${mode === "mix" ? "active" : ""}`} onClick={() => setMode("mix")}>Mix salvat</div>
        <div className={`tab ${mode === "manual" ? "active" : ""}`} onClick={() => setMode("manual")}>Manual</div>
      </div>

      <form onSubmit={submit}>
        {mode === "mix" && (
          <div className="field">
            <label>Mix</label>
            <select value={mixId} onChange={(e) => setMixId(e.target.value)}>
              <option value="">Selecteaza mix</option>
              {mixes.map((m) => (
                <option key={m.id} value={m.id}>{m.name || `Mix ${m.id}`}</option>
              ))}
            </select>
          </div>
        )}

        {mode === "manual" && (
          <div className="field">
            <label>Produse + doze</label>
            {items.map((row, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, marginBottom: 8 }}>
                <select value={row.product_id} onChange={(e) => updateRow(idx, "product_id", e.target.value)}>
                  <option value="">Selecteaza produs</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.trade_name}</option>
                  ))}
                </select>
                <input value={row.dose_per_ha} onChange={(e) => updateRow(idx, "dose_per_ha", e.target.value)} placeholder="Ex: 1,5" />
                <select value={row.uom} onChange={(e) => updateRow(idx, "uom", e.target.value)}>
                  <option value="L/ha">L/ha</option>
                  <option value="kg/ha">kg/ha</option>
                </select>
                <button className="button ghost" type="button" onClick={() => removeRow(idx)}>-</button>
              </div>
            ))}
            <button className="button secondary" type="button" onClick={addRow}>Adauga produs</button>
          </div>
        )}

        <div className="field">
          <label>Data</label>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div className="field">
          <label>Suprafata (ha)</label>
          <input value={form.area_ha} onChange={(e) => setForm({ ...form, area_ha: e.target.value })} placeholder="Ex: 12,5" />
        </div>
        <div className="field">
          <label>Apa (l/ha)</label>
          <input value={form.water_l_per_ha} onChange={(e) => setForm({ ...form, water_l_per_ha: e.target.value })} placeholder="Optional" />
        </div>
        <div className="field">
          <label>Volum rezervor (l)</label>
          <input value={form.tank_volume_l} onChange={(e) => setForm({ ...form, tank_volume_l: e.target.value })} placeholder="Optional" />
        </div>
        <div className="field">
          <label>Utilaj</label>
          <input value={form.machine} onChange={(e) => setForm({ ...form, machine: e.target.value })} />
        </div>
        <button className="button" type="submit">Salveaza aplicare</button>
      </form>

      <div style={{ marginTop: 12 }} className="list">
        {apps.map((a) => (
          <div className="list-item" key={a.id}>
            <strong>{a.date}</strong> · {a.area_ha} ha · cost {a.total_cost ? a.total_cost.toFixed(2) : "-"}
          </div>
        ))}
      </div>
    </div>
  );
}
