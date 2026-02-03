import React, { useEffect, useState } from "react";
import api from "../api";

type InventoryItem = {
  id: number;
  item_type: string;
  qty: number;
  uom?: string;
  ref_id?: number;
};

type ActiveSubstance = {
  id: number;
  name: string;
};

type ChemProduct = {
  id: number;
  trade_name: string;
  product_type?: string;
  formulation?: string;
  density_kg_per_l?: number;
  default_uom?: string;
  actives?: Array<{
    active_id?: number;
    active_name: string;
    concentration: number;
    unit: string;
  }>;
};

const parseDecimal = (value: string) => {
  const cleaned = value.replace(",", ".").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
};

export default function InventoryForms() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [form, setForm] = useState({ item_type: "herbicide", qty: "", uom: "l", ref_id: "" });
  const [labelResult, setLabelResult] = useState<any>(null);
  const [actives, setActives] = useState<ActiveSubstance[]>([]);
  const [products, setProducts] = useState<ChemProduct[]>([]);
  const [productTab, setProductTab] = useState<"herbicide" | "fertilizer">("herbicide");
  const [lots, setLots] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [activeQuery, setActiveQuery] = useState("");
  const [activeStock, setActiveStock] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [activeName, setActiveName] = useState("");
  const [productForm, setProductForm] = useState({
    trade_name: "",
    product_type: "herbicide",
    formulation: "",
    density_kg_per_l: "",
    default_uom: "l",
    actives: [
      { active_id: "", active_name: "", concentration: "", unit: "%w/w" }
    ]
  });

  const load = async () => {
    const [invRes, activeRes, prodRes] = await Promise.all([
      api.get("/inventory/items"),
      api.get("/catalog/actives"),
      api.get("/inventory/items", { params: { kind: "chem" } })
    ]);
    setItems(invRes.data || []);
    setActives(activeRes.data || []);
    setProducts(prodRes.data || []);
    const lotRes = await api.get("/inventory/lots");
    setLots(lotRes.data || []);
    const alertRes = await api.get("/reports/alerts");
    setAlerts(alertRes.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const filtered = products.filter((p) => p.product_type === productTab);
    if (!filtered.length) {
      setSelectedProductId(null);
      return;
    }
    if (!selectedProductId || !filtered.some((p) => p.id === selectedProductId)) {
      setSelectedProductId(filtered[0].id);
    }
  }, [products, productTab, selectedProductId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = parseDecimal(form.qty);
    if (qtyNum === null) return;
    await api.post("/inventory/items", {
      item_type: form.item_type,
      qty: qtyNum,
      uom: form.uom,
      ref_id: (form.item_type === "herbicide" || form.item_type === "fertilizer") && form.ref_id
        ? Number(form.ref_id)
        : undefined
    });
    setForm({ ...form, qty: "" });
    load();
  };

  const handleLabel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post("/inventory/ingest-label", formData, { headers: { "Content-Type": "multipart/form-data" } });
    setLabelResult(res.data.parsed);
    if (res.data.parsed?.trade_name) {
      setProductForm((prev) => ({ ...prev, trade_name: res.data.parsed.trade_name }));
    }
    const firstActive = res.data.parsed?.actives?.[0];
    if (firstActive) {
      setProductForm((prev) => ({
        ...prev,
        actives: [
          {
            active_id: firstActive.active_id ? String(firstActive.active_id) : "",
            active_name: firstActive.name || "",
            concentration: firstActive.concentration ? String(firstActive.concentration) : "",
            unit: firstActive.unit || prev.actives[0].unit
          }
        ]
      }));
    }
  };

  const createActive = async () => {
    if (!activeName.trim()) return;
    await api.post("/catalog/actives", { name: activeName.trim() });
    setActiveName("");
    load();
  };

  const submitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const activesPayload = productForm.actives
      .map((row) => ({
        active_id: row.active_id ? Number(row.active_id) : undefined,
        active_name: row.active_name || undefined,
        concentration: parseDecimal(row.concentration),
        unit: row.unit
      }))
      .filter((row) => row.active_id || row.active_name);
    await api.post("/inventory/items", {
      trade_name: productForm.trade_name,
      product_type: productForm.product_type,
      formulation: productForm.formulation || undefined,
      density_kg_per_l: productForm.density_kg_per_l ? parseDecimal(productForm.density_kg_per_l) : undefined,
      default_uom: productForm.default_uom,
      actives: activesPayload
    });
    setProductForm({
      trade_name: "",
      product_type: productTab,
      formulation: "",
      density_kg_per_l: "",
      default_uom: "l",
      actives: [
        { active_id: "", active_name: "", concentration: "", unit: "%w/w" }
      ]
    });
    load();
  };

  const [lotForm, setLotForm] = useState({
    product_id: "",
    lot_code: "",
    received_date: new Date().toISOString().slice(0, 10),
    expires_at: "",
    qty: "",
    uom: "kg",
    unit_price: ""
  });

  const submitLot = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = parseDecimal(lotForm.qty);
    const productId = lotForm.product_id || (selectedProductId ? String(selectedProductId) : "");
    if (!productId || !qtyNum) return;
    await api.post("/inventory/lots", {
      product_id: Number(productId),
      lot_code: lotForm.lot_code,
      received_date: lotForm.received_date,
      expires_at: lotForm.expires_at,
      qty: qtyNum,
      uom: lotForm.uom,
      unit_price: lotForm.unit_price ? parseDecimal(lotForm.unit_price) : undefined
    });
    setLotForm({
      product_id: "",
      lot_code: "",
      received_date: new Date().toISOString().slice(0, 10),
      expires_at: "",
      qty: "",
      uom: "kg",
      unit_price: ""
    });
    load();
  };

  const fetchActiveStock = async () => {
    if (!activeQuery.trim()) return;
    const res = await api.get("/reports/active-stock", { params: { active: activeQuery.trim() } });
    setActiveStock(res.data);
  };

  const filteredProducts = products
    .filter((p) => p.product_type === productTab)
    .filter((p) => p.trade_name.toLowerCase().includes(search.toLowerCase()));

  const selectedProduct = products.find((p) => p.id === selectedProductId) || null;
  const productLots = selectedProduct
    ? lots.filter((l) => l.product_id === selectedProduct.id)
    : [];
  const productQty = productLots.reduce((sum, l) => sum + Number(l.qty || 0), 0);

  const updateActiveRow = (idx: number, key: string, value: string) => {
    setProductForm((prev) => ({
      ...prev,
      actives: prev.actives.map((row, i) => (i === idx ? { ...row, [key]: value } : row))
    }));
  };

  const addActiveRow = () => {
    setProductForm((prev) => ({
      ...prev,
      actives: [...prev.actives, { active_id: "", active_name: "", concentration: "", unit: "%w/w" }]
    }));
  };

  const removeActiveRow = (idx: number) => {
    setProductForm((prev) => ({
      ...prev,
      actives: prev.actives.filter((_, i) => i !== idx)
    }));
  };

  return (
    <div>
      <div className="inventory-layout">
        <div className="panel">
          <div className="tabs" style={{ marginBottom: 10 }}>
            <div className={`tab ${productTab === "herbicide" ? "active" : ""}`} onClick={() => {
              setProductTab("herbicide");
              setProductForm((prev) => ({ ...prev, product_type: "herbicide", default_uom: "l" }));
            }}>Erbicide</div>
            <div className={`tab ${productTab === "fertilizer" ? "active" : ""}`} onClick={() => {
              setProductTab("fertilizer");
              setProductForm((prev) => ({ ...prev, product_type: "fertilizer", default_uom: "kg" }));
            }}>Ingrasaminte</div>
          </div>
          <div className="field">
            <label>Cauta produs</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ex: Roundup, NPK" />
          </div>
          <div className="inventory-list">
            {filteredProducts.map((p) => (
              <div
                key={p.id}
                className={`inventory-card ${selectedProductId === p.id ? "active" : ""}`}
                onClick={() => setSelectedProductId(p.id)}
              >
                <strong>{p.trade_name}</strong>
                <div className="small">{p.formulation || "—"}</div>
                <div className="inventory-kpi">
                  <span>Stoc: {lots.filter((l) => l.product_id === p.id).reduce((s, l) => s + Number(l.qty || 0), 0).toFixed(2)} {p.default_uom || "kg"}</span>
                </div>
              </div>
            ))}
            {!filteredProducts.length && <div className="small">Nu exista produse.</div>}
          </div>
        </div>

        <div className="panel">
          <h3 style={{ marginTop: 0 }}>{selectedProduct?.trade_name || "Selecteaza un produs"}</h3>
          {selectedProduct && (
            <>
              <div className="small" style={{ marginBottom: 8 }}>
                Tip: {selectedProduct.product_type} · Stoc total: {productQty.toFixed(2)} {selectedProduct.default_uom || "kg"}
              </div>
              <div className="list">
                {selectedProduct.actives?.map((a, idx) => (
                  <div className="list-item" key={idx}>
                    {a.active_name} {a.concentration} {a.unit}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16 }} className="panel">
                <h4 style={{ marginTop: 0 }}>Intrare stoc (lot)</h4>
                <form onSubmit={submitLot}>
                  <div className="field">
                    <label>Lot</label>
                    <input value={lotForm.lot_code} onChange={(e) => setLotForm({ ...lotForm, lot_code: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Data receptie</label>
                    <input type="date" value={lotForm.received_date} onChange={(e) => setLotForm({ ...lotForm, received_date: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Expira la</label>
                    <input type="date" value={lotForm.expires_at} onChange={(e) => setLotForm({ ...lotForm, expires_at: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Cantitate</label>
                    <input value={lotForm.qty} onChange={(e) => setLotForm({ ...lotForm, qty: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Unitate</label>
                    <select value={lotForm.uom} onChange={(e) => setLotForm({ ...lotForm, uom: e.target.value })}>
                      <option value="kg">KG</option>
                      <option value="l">L</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Pret unitar</label>
                    <input value={lotForm.unit_price} onChange={(e) => setLotForm({ ...lotForm, unit_price: e.target.value })} placeholder="Ex: 12,5" />
                  </div>
                  <button className="button" type="submit">Adauga lot</button>
                </form>
              </div>

              <div style={{ marginTop: 16 }} className="panel">
                <h4 style={{ marginTop: 0 }}>Loturi</h4>
                <div className="list">
                  {productLots.map((l) => (
                    <div className="list-item" key={l.id}>
                      Lot {l.lot_code} · {l.qty} {l.uom} · expira {l.expires_at}
                    </div>
                  ))}
                  {!productLots.length && <div className="small">Nu exista loturi.</div>}
                </div>
              </div>
            </>
          )}

          <div style={{ marginTop: 16 }} className="panel">
            <h4 style={{ marginTop: 0 }}>Adauga produs nou</h4>
            <div className="small" style={{ marginBottom: 8 }}>Tip: {productTab === "herbicide" ? "Erbicid" : "Ingrasamant"}</div>
            <div className="field">
              <label>Adauga substanta activa</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={activeName} onChange={(e) => setActiveName(e.target.value)} placeholder="glifosat acid" />
                <button className="button secondary" type="button" onClick={createActive}>Adauga</button>
              </div>
            </div>
            <form onSubmit={submitProduct}>
              <div className="field">
                <label>Produs (denumire comerciala)</label>
                <input value={productForm.trade_name} onChange={(e) => setProductForm({ ...productForm, trade_name: e.target.value })} />
              </div>
              <div className="field">
                <label>Formulare</label>
                <input value={productForm.formulation} onChange={(e) => setProductForm({ ...productForm, formulation: e.target.value })} placeholder="SL, WG, EC" />
              </div>
              <div className="field">
                <label>Densitate (kg/L)</label>
                <input value={productForm.density_kg_per_l} onChange={(e) => setProductForm({ ...productForm, density_kg_per_l: e.target.value })} placeholder="Ex: 1,05" />
              </div>
              <div className="field">
                <label>Unitate implicita</label>
                <select value={productForm.default_uom} onChange={(e) => setProductForm({ ...productForm, default_uom: e.target.value })}>
                  <option value="l">L</option>
                  <option value="kg">KG</option>
                </select>
              </div>
              <div className="field">
                <label>Substante active</label>
                {productForm.actives.map((row, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 8 }}>
                    <select value={row.active_id} onChange={(e) => updateActiveRow(idx, "active_id", e.target.value)}>
                      <option value="">Catalog</option>
                      {actives.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <input value={row.active_name} onChange={(e) => updateActiveRow(idx, "active_name", e.target.value)} placeholder="sau manual" />
                    <input value={row.concentration} onChange={(e) => updateActiveRow(idx, "concentration", e.target.value)} placeholder="Ex: 15 sau 36,5" />
                    <select value={row.unit} onChange={(e) => updateActiveRow(idx, "unit", e.target.value)}>
                      <option value="g/L">g/L</option>
                      <option value="g/kg">g/kg</option>
                      <option value="%w/w">%w/w</option>
                      <option value="%w/v">%w/v</option>
                    </select>
                    <button className="button ghost" type="button" onClick={() => removeActiveRow(idx)}>-</button>
                  </div>
                ))}
                <button className="button secondary" type="button" onClick={addActiveRow}>Adauga substanta</button>
              </div>
              <button className="button" type="submit">Salveaza produs</button>
            </form>

            {productTab === "herbicide" && (
              <div style={{ marginTop: 12 }}>
                <label className="small">OCR eticheta erbicid</label>
                <input type="file" onChange={handleLabel} />
                {labelResult && (
                  <div className="notice" style={{ marginTop: 8 }}>
                    <div><strong>{labelResult.trade_name}</strong></div>
                    {labelResult.actives?.map((a: any, idx: number) => (
                      <div key={idx} className="small">{a.name} {a.concentration || ""} {a.unit || ""}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }} className="panel">
        <h3 style={{ marginTop: 0 }}>Alerte expirare</h3>
        <div className="list">
          {alerts.map((a) => (
            <div className="list-item" key={a.lot_id}>
              <strong>{products.find((p) => p.id === a.product_id)?.trade_name || `Produs #${a.product_id}`}</strong>
              {" "}· lot {a.lot_code} · {a.expires_in_days} zile
            </div>
          ))}
          {!alerts.length && <div className="small">Nu sunt alerte.</div>}
        </div>
      </div>

      <div style={{ marginTop: 18 }} className="panel">
        <h3 style={{ marginTop: 0 }}>Stoc substanta activa</h3>
        <div className="field">
          <label>Substanta activa</label>
          <input value={activeQuery} onChange={(e) => setActiveQuery(e.target.value)} placeholder="glifosat acid" />
        </div>
        <button className="button secondary" type="button" onClick={fetchActiveStock}>Cauta</button>
        {activeStock && (
          <div className="notice" style={{ marginTop: 10 }}>
            Total: {activeStock.total_kg} kg
          </div>
        )}
      </div>
    </div>
  );
}
