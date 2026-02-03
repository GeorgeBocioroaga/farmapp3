import React, { useEffect, useState } from "react";
import api from "../api";

const parseDecimal = (value: string) => {
  const cleaned = value.replace(",", ".").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
};

type Active = { id: number; name: string; cas_no?: string; synonyms?: string[] };

type Product = {
  id: number;
  trade_name: string;
  formulation?: string;
  supplier?: string;
  ean13?: string;
  registration_no?: string;
  density_kg_per_l?: number;
  compat_notes?: string;
  actives?: Array<{ active_id?: number; active_name: string; concentration: number; unit: string }>;
};

type Lot = {
  id: number;
  product_id: number;
  lot_code: string;
  received_date: string;
  expires_at: string;
  qty: number;
  uom: string;
  unit_price?: number;
};

type Txn = {
  id: number;
  lot_id: number;
  movement: string;
  qty: number;
  uom: string;
  date: string;
  reason?: string;
};

type Parcel = { id: number; name: string; area_m2?: number };

type Application = { id: number; date: string; area_ha: number; total_cost?: number };

export default function HerbicideModule() {
  const [tab, setTab] = useState<"products" | "stock" | "applications">("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [actives, setActives] = useState<Active[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");

  const [activeForm, setActiveForm] = useState({ name: "", cas_no: "", synonyms: "" });
  const [productForm, setProductForm] = useState({
    trade_name: "",
    formulation: "",
    supplier: "",
    registration_no: "",
    ean13: "",
    density_kg_per_l: "",
    actives: [{ active_id: "", active_name: "", concentration: "", unit: "g/L" }]
  });

  const [lotForm, setLotForm] = useState({
    product_id: "",
    lot_code: "",
    received_date: new Date().toISOString().slice(0, 10),
    expires_at: "",
    qty: "",
    uom: "L",
    unit_price: ""
  });

  const [txnForm, setTxnForm] = useState({
    lot_id: "",
    movement: "out",
    qty: "",
    uom: "L",
    date: new Date().toISOString().slice(0, 10),
    reason: "adjust"
  });

  const [appForm, setAppForm] = useState({
    parcel_id: "",
    date: new Date().toISOString().slice(0, 10),
    area_ha: "",
    items: [{ product_id: "", dose_per_ha: "", uom: "L/ha" }]
  });

  const load = async () => {
    const [pRes, aRes, lRes, tRes, appRes] = await Promise.all([
      api.get("/inventory/products", { params: { product_type: "herbicide" } }),
      api.get("/inventory/actives"),
      api.get("/inventory/lots"),
      api.get("/inventory/txns"),
      api.get("/inventory/applications")
    ]);
    setProducts(pRes.data || []);
    setActives(aRes.data || []);
    setLots(lRes.data || []);
    setTxns(tRes.data || []);
    setApplications(appRes.data || []);
    try {
      const parcelRes = await api.get("/parcels");
      const items = parcelRes.data.items || parcelRes.data || [];
      setParcels(items.map((p: any) => ({ id: p.id || p.properties?.id, name: p.name || p.properties?.name, area_m2: p.area_m2 || p.properties?.area_m2 })));
    } catch {
      setParcels([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedProductId && products.length) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  const addActiveRow = () => {
    setProductForm((prev) => ({
      ...prev,
      actives: [...prev.actives, { active_id: "", active_name: "", concentration: "", unit: "g/L" }]
    }));
  };

  const updateActiveRow = (idx: number, key: string, value: string) => {
    setProductForm((prev) => ({
      ...prev,
      actives: prev.actives.map((row, i) => (i === idx ? { ...row, [key]: value } : row))
    }));
  };

  const removeActiveRow = (idx: number) => {
    setProductForm((prev) => ({
      ...prev,
      actives: prev.actives.filter((_, i) => i !== idx)
    }));
  };

  const handleError = (err: any, fallback: string) => {
    const detail = err?.response?.data?.detail;
    if (Array.isArray(detail)) {
      setError(detail.map((d) => d.msg).join(", "));
      return;
    }
    if (typeof detail === "string") {
      setError(detail);
      return;
    }
    setError(fallback);
  };

  const submitActive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeForm.name.trim()) return;
    try {
      await api.post("/inventory/actives", {
        name: activeForm.name.trim(),
        cas_no: activeForm.cas_no || undefined,
        synonyms: activeForm.synonyms ? activeForm.synonyms.split(",").map((s) => s.trim()).filter(Boolean) : undefined
      });
      setActiveForm({ name: "", cas_no: "", synonyms: "" });
      setError("");
      load();
    } catch (err) {
      handleError(err, "Nu s-a putut salva substanta activa.");
    }
  };

  const submitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const activesPayload = productForm.actives
      .map((row) => ({
        active_id: row.active_id ? Number(row.active_id) : undefined,
        active_name: row.active_name || undefined,
        concentration: parseDecimal(row.concentration) || 0,
        unit: row.unit
      }))
      .filter((row) => row.active_id || row.active_name);

    try {
      await api.post("/inventory/products", {
        trade_name: productForm.trade_name,
        formulation: productForm.formulation || undefined,
        supplier: productForm.supplier || undefined,
        registration_no: productForm.registration_no || undefined,
        ean13: productForm.ean13 || undefined,
        density_kg_per_l: productForm.density_kg_per_l ? parseDecimal(productForm.density_kg_per_l) : undefined,
        actives: activesPayload
      });
      setProductForm({
        trade_name: "",
        formulation: "",
        supplier: "",
        registration_no: "",
        ean13: "",
        density_kg_per_l: "",
        actives: [{ active_id: "", active_name: "", concentration: "", unit: "g/L" }]
      });
      setOcrResult(null);
      setOcrFile(null);
      setError("");
      load();
    } catch (err) {
      handleError(err, "Nu s-a putut salva produsul.");
    }
  };

  const handleOcr = async () => {
    if (!ocrFile) return;
    const file = ocrFile;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await api.post("/inventory/ingest-label", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setOcrResult(res.data);
      if (res.data.product_suggestion?.trade_name) {
        setProductForm((prev) => ({ ...prev, trade_name: res.data.product_suggestion.trade_name }));
      }
      if (res.data.ean13) {
        setProductForm((prev) => ({ ...prev, ean13: res.data.ean13 }));
      }
      if (res.data.actives_suggestion?.length) {
        setProductForm((prev) => ({
          ...prev,
          actives: res.data.actives_suggestion.map((a: any) => ({
            active_id: a.active_id ? String(a.active_id) : "",
            active_name: a.name || "",
            concentration: a.concentration ? String(a.concentration) : "",
            unit: a.unit || "g/L"
          }))
        }));
      }
      setError("");
    } catch (err) {
      handleError(err, "OCR nu a putut procesa fisierul.");
    }
  };

  const submitLot = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = parseDecimal(lotForm.qty);
    if (!lotForm.product_id || !qtyNum) return;
    const payload: any = {
      product_id: Number(lotForm.product_id),
      lot_code: lotForm.lot_code,
      received_date: lotForm.received_date,
      qty: qtyNum,
      uom: lotForm.uom,
      unit_price: lotForm.unit_price ? parseDecimal(lotForm.unit_price) : undefined
    };
    if (lotForm.expires_at) {
      payload.expiry_date = lotForm.expires_at;
    }
    try {
      await api.post("/inventory/lots", payload);
      setLotForm({ product_id: "", lot_code: "", received_date: new Date().toISOString().slice(0, 10), expires_at: "", qty: "", uom: "L", unit_price: "" });
      setError("");
      load();
    } catch (err) {
      handleError(err, "Nu s-a putut salva lotul.");
    }
  };

  const submitTxn = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = parseDecimal(txnForm.qty);
    if (!txnForm.lot_id || !qtyNum) return;
    try {
      await api.post("/inventory/txns", {
        lot_id: Number(txnForm.lot_id),
        movement: txnForm.movement,
        qty: qtyNum,
        uom: txnForm.uom,
        date: txnForm.date,
        reason: txnForm.reason
      });
      setTxnForm({ lot_id: "", movement: "out", qty: "", uom: "L", date: new Date().toISOString().slice(0, 10), reason: "adjust" });
      setError("");
      load();
    } catch (err) {
      handleError(err, "Nu s-a putut salva miscarea.");
    }
  };

  const submitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    const area = parseDecimal(appForm.area_ha);
    if (!appForm.parcel_id || !area) return;
    const items = appForm.items
      .map((row) => ({
        product_id: row.product_id ? Number(row.product_id) : 0,
        dose_per_ha: parseDecimal(row.dose_per_ha) || 0,
        uom: row.uom
      }))
      .filter((row) => row.product_id && row.dose_per_ha > 0);
    if (!items.length) return;
    try {
      await api.post("/inventory/applications", {
        parcel_id: Number(appForm.parcel_id),
        date: appForm.date,
        area_ha: area,
        items
      });
      setAppForm({ parcel_id: "", date: new Date().toISOString().slice(0, 10), area_ha: "", items: [{ product_id: "", dose_per_ha: "", uom: "L/ha" }] });
      setError("");
      load();
    } catch (err) {
      handleError(err, "Nu s-a putut salva aplicarea.");
    }
  };

  const addAppRow = () => {
    setAppForm((prev) => ({
      ...prev,
      items: [...prev.items, { product_id: "", dose_per_ha: "", uom: "L/ha" }]
    }));
  };

  const updateAppRow = (idx: number, key: string, value: string) => {
    setAppForm((prev) => ({
      ...prev,
      items: prev.items.map((row, i) => (i === idx ? { ...row, [key]: value } : row))
    }));
  };

  const removeAppRow = (idx: number) => {
    setAppForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const exportExcel = () => {
    window.location.href = "/api/inventory/export.xlsx?scope=all";
  };

  const filteredProducts = products.filter((p) => p.trade_name.toLowerCase().includes(search.toLowerCase()));
  const selectedProduct = products.find((p) => p.id === selectedProductId) || null;
  const productIdSet = new Set(products.map((p) => p.id));
  const herbicideLots = lots.filter((l) => productIdSet.has(l.product_id));
  const lotIdSet = new Set(herbicideLots.map((l) => l.id));
  const herbicideTxns = txns.filter((t) => lotIdSet.has(t.lot_id));

  return (
    <div>
      <div className="tabs" style={{ marginBottom: 12 }}>
        <div className={`tab ${tab === "products" ? "active" : ""}`} onClick={() => setTab("products")}>Produse</div>
        <div className={`tab ${tab === "stock" ? "active" : ""}`} onClick={() => setTab("stock")}>Stoc</div>
        <div className={`tab ${tab === "applications" ? "active" : ""}`} onClick={() => setTab("applications")}>Aplicari</div>
        <button className="button secondary" style={{ marginLeft: "auto" }} onClick={exportExcel}>Export Excel</button>
      </div>

      {error && <div className="panel" style={{ background: "#fff2f2", borderColor: "#f3b0b0" }}>{error}</div>}

      {tab === "products" && (
        <div className="inventory-layout">
          <div className="panel">
            <div className="field">
              <label>Cauta produs</label>
              <input value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="inventory-list">
              {filteredProducts.map((p) => (
                <div key={p.id} className={`inventory-card ${selectedProductId === p.id ? "active" : ""}`} onClick={() => setSelectedProductId(p.id)}>
                  <strong>{p.trade_name}</strong>
                  <div className="small">{p.formulation || "?"}</div>
                </div>
              ))}
              {!filteredProducts.length && <div className="small">Nu exista produse.</div>}
            </div>
          </div>
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>Adauga produs</h3>
            <div className="field">
              <label>Scan eticheta (OCR)</label>
              <input type="file" onChange={(e) => setOcrFile(e.target.files?.[0] || null)} />
              <button className="button secondary" type="button" onClick={handleOcr} disabled={!ocrFile} style={{ marginTop: 8 }}>
                Completeaza automat (OCR)
              </button>
              {ocrResult && <div className="small">OCR precompletat. Verifica inainte de salvare.</div>}
            </div>
            <form onSubmit={submitProduct}>
              <div className="field"><label>Denumire comerciala</label><input value={productForm.trade_name} onChange={(e) => setProductForm({ ...productForm, trade_name: e.target.value })} /></div>
              <div className="field"><label>Formulare</label><input value={productForm.formulation} onChange={(e) => setProductForm({ ...productForm, formulation: e.target.value })} /></div>
              <div className="field"><label>Furnizor</label><input value={productForm.supplier} onChange={(e) => setProductForm({ ...productForm, supplier: e.target.value })} /></div>
              <div className="field"><label>Nr. inregistrare</label><input value={productForm.registration_no} onChange={(e) => setProductForm({ ...productForm, registration_no: e.target.value })} /></div>
              <div className="field"><label>EAN13</label><input value={productForm.ean13} onChange={(e) => setProductForm({ ...productForm, ean13: e.target.value })} /></div>
              <div className="field"><label>Densitate (kg/L)</label><input value={productForm.density_kg_per_l} onChange={(e) => setProductForm({ ...productForm, density_kg_per_l: e.target.value })} /></div>
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
                    <input value={row.concentration} onChange={(e) => updateActiveRow(idx, "concentration", e.target.value)} />
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

            <div style={{ marginTop: 16 }} className="panel">
              <h4 style={{ marginTop: 0 }}>Catalog substante active</h4>
              <form onSubmit={submitActive}>
                <div className="field"><label>Nume</label><input value={activeForm.name} onChange={(e) => setActiveForm({ ...activeForm, name: e.target.value })} /></div>
                <div className="field"><label>CAS</label><input value={activeForm.cas_no} onChange={(e) => setActiveForm({ ...activeForm, cas_no: e.target.value })} /></div>
                <div className="field"><label>Sinonime (separate prin virgula)</label><input value={activeForm.synonyms} onChange={(e) => setActiveForm({ ...activeForm, synonyms: e.target.value })} /></div>
                <button className="button" type="submit">Adauga substanta</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {tab === "stock" && (
        <div className="inventory-layout">
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>Loturi</h3>
            <div className="list">
              {herbicideLots.map((l) => (
                <div className="list-item" key={l.id}>
                  <strong>{products.find((p) => p.id === l.product_id)?.trade_name || `Produs #${l.product_id}`}</strong>
                  {" "}? lot {l.lot_code} ? {l.qty} {l.uom} ? expira {l.expires_at || "fara expirare"}
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>Intrare in stoc</h3>
            <form onSubmit={submitLot}>
              <div className="field"><label>Produs</label>
                <select value={lotForm.product_id} onChange={(e) => setLotForm({ ...lotForm, product_id: e.target.value })}>
                  <option value="">Selecteaza produs</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.trade_name}</option>
                  ))}
                </select>
              </div>
              <div className="field"><label>Lot</label><input value={lotForm.lot_code} onChange={(e) => setLotForm({ ...lotForm, lot_code: e.target.value })} /></div>
              <div className="field"><label>Data receptie</label><input type="date" value={lotForm.received_date} onChange={(e) => setLotForm({ ...lotForm, received_date: e.target.value })} /></div>
              <div className="field"><label>Expira la</label><input type="date" value={lotForm.expires_at} onChange={(e) => setLotForm({ ...lotForm, expires_at: e.target.value })} /></div>
              <div className="field"><label>Cantitate</label><input value={lotForm.qty} onChange={(e) => setLotForm({ ...lotForm, qty: e.target.value })} /></div>
              <div className="field"><label>UoM</label>
                <select value={lotForm.uom} onChange={(e) => setLotForm({ ...lotForm, uom: e.target.value })}>
                  <option value="L">L</option>
                  <option value="kg">kg</option>
                </select>
              </div>
              <div className="field"><label>Pret unitar</label><input value={lotForm.unit_price} onChange={(e) => setLotForm({ ...lotForm, unit_price: e.target.value })} /></div>
              <button className="button" type="submit">Salveaza lot</button>
            </form>

            <div style={{ marginTop: 16 }} className="panel">
              <h4 style={{ marginTop: 0 }}>Miscari (ajustari rapide)</h4>
              <form onSubmit={submitTxn}>
                <div className="field"><label>Lot</label>
                  <select value={txnForm.lot_id} onChange={(e) => setTxnForm({ ...txnForm, lot_id: e.target.value })}>
                    <option value="">Selecteaza lot</option>
                    {herbicideLots.map((l) => (
                      <option key={l.id} value={l.id}>{l.lot_code} ? {products.find((p) => p.id === l.product_id)?.trade_name}</option>
                    ))}
                  </select>
                </div>
                <div className="field"><label>Tip</label>
                  <select value={txnForm.movement} onChange={(e) => setTxnForm({ ...txnForm, movement: e.target.value })}>
                    <option value="in">In</option>
                    <option value="out">Out</option>
                    <option value="adjust">Adjust</option>
                  </select>
                </div>
                <div className="field"><label>Motiv</label>
                  <select value={txnForm.reason} onChange={(e) => setTxnForm({ ...txnForm, reason: e.target.value })}>
                    <option value="stocktake">stocktake</option>
                    <option value="correction">correction</option>
                    <option value="disposal">disposal</option>
                  </select>
                </div>
                <div className="field"><label>Cantitate</label><input value={txnForm.qty} onChange={(e) => setTxnForm({ ...txnForm, qty: e.target.value })} /></div>
                <div className="field"><label>UoM</label>
                  <select value={txnForm.uom} onChange={(e) => setTxnForm({ ...txnForm, uom: e.target.value })}>
                    <option value="L">L</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
                <button className="button" type="submit">Salveaza miscare</button>
              </form>
              <div className="list" style={{ marginTop: 12 }}>
                {herbicideTxns.map((t) => (
                  <div className="list-item" key={t.id}>
                    {t.date} ? {t.movement} ? {t.qty} {t.uom} ? {t.reason || ""}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "applications" && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Aplicare pe parcela</h3>
          <form onSubmit={submitApplication}>
            <div className="field"><label>Parcela</label>
              <select value={appForm.parcel_id} onChange={(e) => setAppForm({ ...appForm, parcel_id: e.target.value })}>
                <option value="">Selecteaza parcela</option>
                {parcels.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="field"><label>Data</label><input type="date" value={appForm.date} onChange={(e) => setAppForm({ ...appForm, date: e.target.value })} /></div>
            <div className="field"><label>Suprafata (ha)</label><input value={appForm.area_ha} onChange={(e) => setAppForm({ ...appForm, area_ha: e.target.value })} /></div>
            <div className="field"><label>Produse + doze</label>
              {appForm.items.map((row, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, marginBottom: 8 }}>
                  <select value={row.product_id} onChange={(e) => updateAppRow(idx, "product_id", e.target.value)}>
                    <option value="">Selecteaza produs</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.trade_name}</option>
                    ))}
                  </select>
                  <input value={row.dose_per_ha} onChange={(e) => updateAppRow(idx, "dose_per_ha", e.target.value)} />
                  <select value={row.uom} onChange={(e) => updateAppRow(idx, "uom", e.target.value)}>
                    <option value="L/ha">L/ha</option>
                    <option value="kg/ha">kg/ha</option>
                  </select>
                  <button className="button ghost" type="button" onClick={() => removeAppRow(idx)}>-</button>
                </div>
              ))}
              <button className="button secondary" type="button" onClick={addAppRow}>Adauga produs</button>
            </div>
            <button className="button" type="submit">Salveaza aplicare</button>
          </form>
          <div className="list" style={{ marginTop: 12 }}>
            {applications.map((a) => (
              <div className="list-item" key={a.id}>
                {a.date} ? {a.area_ha} ha ? cost {a.total_cost ? a.total_cost.toFixed(2) : "-"}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
