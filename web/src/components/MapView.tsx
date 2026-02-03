import React, { useCallback, useEffect, useRef, useState } from "react";
import { GoogleMap, Polygon, DrawingManager, useLoadScript } from "@react-google-maps/api";
import api from "../api";

export type ParcelFeature = {
  id: number;
  name: string;
  area_m2?: number;
  cf_number?: string;
  geometry: GeoJSON.Polygon;
};

type MapViewProps = {
  parcels: ParcelFeature[];
  setParcels: (items: ParcelFeature[]) => void;
  selectedParcel: ParcelFeature | null;
  onSelectParcel: (p: ParcelFeature | null) => void;
  onParcelCreated: (p: ParcelFeature) => void;
  onParcelUpdated: (p: ParcelFeature) => void;
};

const mapContainerStyle = { width: "100%", height: "100%" };

export default function MapView({
  parcels,
  setParcels,
  selectedParcel,
  onSelectParcel,
  onParcelCreated,
  onParcelUpdated
}: MapViewProps) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ["drawing", "geometry"]
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const debounceRef = useRef<number | null>(null);
  const polygonRefs = useRef<Record<number, google.maps.Polygon>>({});

  const [draftPolygon, setDraftPolygon] = useState<google.maps.Polygon | null>(null);
  const [draftArea, setDraftArea] = useState<number>(0);
  const [draftName, setDraftName] = useState<string>("");
  const [draftCF, setDraftCF] = useState<string>("");
  const [drawingMode, setDrawingMode] = useState<google.maps.drawing.OverlayType | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPdf, setImportPdf] = useState<File | null>(null);
  const [importExcel, setImportExcel] = useState<File | null>(null);
  const [importCFNumber, setImportCFNumber] = useState("");
  const [importParcelName, setImportParcelName] = useState("");
  const [importCounty, setImportCounty] = useState("");
  const [importLocality, setImportLocality] = useState("");

  const mapOptions: google.maps.MapOptions = {
    mapTypeId: window.google?.maps?.MapTypeId?.SATELLITE || "satellite",
    tilt: 0,
    heading: 0,
    maxZoom: 21,
    gestureHandling: "greedy",
    mapTypeControl: true,
    mapTypeControlOptions: {
      mapTypeIds: [window.google?.maps?.MapTypeId?.SATELLITE || "satellite", window.google?.maps?.MapTypeId?.HYBRID || "hybrid"]
    },
    styles: [
      { featureType: "poi", stylers: [{ visibility: "off" }] },
      { featureType: "transit", stylers: [{ visibility: "off" }] }
    ]
  };

  const fetchParcels = useCallback(async () => {
    if (!mapRef.current) return;
    const bounds = mapRef.current.getBounds();
    if (!bounds) return;
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const zoom = mapRef.current.getZoom() || 16;
    const bbox = `${sw.lng()},${sw.lat()},${ne.lng()},${ne.lat()}`;
    const res = await api.get("/parcels", { params: { bbox, zoom } });
    const features = res.data.features || [];
    const mapped = features.map((f: any) => ({
      id: f.properties.id,
      name: f.properties.name,
      area_m2: f.properties.area_m2,
      cf_number: f.properties.cf_number,
      geometry: f.geometry
    }));
    setParcels(mapped);
  }, [setParcels]);

  const scheduleFetch = useCallback(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      fetchParcels();
    }, 400);
  }, [fetchParcels]);

  useEffect(() => {
    scheduleFetch();
  }, [scheduleFetch]);

  const handleLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    scheduleFetch();
  }, [scheduleFetch]);

  const handlePolygonComplete = (polygon: google.maps.Polygon) => {
    setDrawingMode(null);
    setDraftPolygon(polygon);
    setDraftName("");
    setDraftCF("");
    updateDraftArea(polygon);

    const path = polygon.getPath();
    path.addListener("set_at", () => updateDraftArea(polygon));
    path.addListener("insert_at", () => updateDraftArea(polygon));
    path.addListener("remove_at", () => updateDraftArea(polygon));
  };

  const updateDraftArea = (polygon: google.maps.Polygon) => {
    const area = google.maps.geometry.spherical.computeArea(polygon.getPath());
    setDraftArea(area);
  };

  const saveDraft = async () => {
    if (!draftPolygon) return;
    const geojson = polygonToGeoJSON(draftPolygon);
    const payload = {
      name: draftName || `Parcel ${Date.now()}`,
      cf_number: draftCF || "NECUNOSCUT",
      geom_geojson: geojson
    };
    const res = await api.post("/parcels", payload);
    const created = {
      id: res.data.id,
      name: payload.name,
      area_m2: res.data.area_m2,
      cf_number: payload.cf_number,
      geometry: geojson
    };
    onParcelCreated(created);
    draftPolygon.setMap(null);
    setDraftPolygon(null);
  };

  const handleLocate = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapRef.current?.panTo({ lat: latitude, lng: longitude });
        mapRef.current?.setZoom(18);
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleImportPdf = async () => {
    setImportError(null);
    if (!importPdf) {
      setImportError("Selecteaza un PDF CF.");
      return;
    }
    if (!importCFNumber.trim()) {
      setImportError("CF este obligatoriu pentru import PDF.");
      return;
    }
    setImportBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", importPdf);
      formData.append("cf_number", importCFNumber.trim());
      if (importParcelName.trim()) formData.append("parcel_name", importParcelName.trim());
      if (importCounty.trim()) formData.append("county", importCounty.trim());
      if (importLocality.trim()) formData.append("locality", importLocality.trim());
      const res = await api.post("/cf/import", formData, { headers: { "Content-Type": "multipart/form-data" } });
      const f = res.data.feature;
      const created = {
        id: f.properties.id,
        name: f.properties.name,
        area_m2: res.data.area_m2,
        cf_number: f.properties.cf_number,
        geometry: f.geometry
      };
      onParcelCreated(created);
      onSelectParcel(created);
      setShowImport(false);
      setImportPdf(null);
      setImportCFNumber("");
      setImportParcelName("");
      setImportCounty("");
      setImportLocality("");
    } catch (err: any) {
      setImportError(err?.response?.data?.detail || "Importul PDF a esuat.");
    } finally {
      setImportBusy(false);
    }
  };

  const handleImportExcel = async () => {
    setImportError(null);
    if (!importExcel) {
      setImportError("Selecteaza un fisier CSV/XLSX.");
      return;
    }
    setImportBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", importExcel);
      await api.post("/cf/import-excel", formData, { headers: { "Content-Type": "multipart/form-data" } });
      await fetchParcels();
      setShowImport(false);
      setImportExcel(null);
    } catch (err: any) {
      setImportError(err?.response?.data?.detail || "Importul Excel/CSV a esuat.");
    } finally {
      setImportBusy(false);
    }
  };

  const saveSelectedEdits = async () => {
    if (!selectedParcel) return;
    const polygon = polygonRefs.current[selectedParcel.id];
    if (!polygon) return;
    const geojson = polygonToGeoJSON(polygon);
    const res = await api.patch(`/parcels/${selectedParcel.id}`, { geom_geojson: geojson });
    const updated = { ...selectedParcel, geometry: geojson, area_m2: res.data.area_m2 };
    onParcelUpdated(updated);
  };

  useEffect(() => {
    if (!selectedParcel || !mapRef.current) return;
    const bounds = new google.maps.LatLngBounds();
    selectedParcel.geometry.coordinates[0].forEach((c) => bounds.extend({ lat: c[1], lng: c[0] }));
    mapRef.current.fitBounds(bounds);
    const zoom = mapRef.current.getZoom() || 18;
    if (zoom < 17) mapRef.current.setZoom(17);
    if (zoom > 19) mapRef.current.setZoom(19);
  }, [selectedParcel]);

  if (!isLoaded) {
    return <div className="panel">Loading map...</div>;
  }

  return (
    <div className="panel map-container">
      <div className="map-tools">
        <span className="badge">Satellite base + Parcel overlay</span>
        <button className="button" onClick={() => setDrawingMode(google.maps.drawing.OverlayType.POLYGON)}>Deseneaza parcela</button>
        <button className="button ghost" onClick={() => setShowImport((v) => !v)}>Import CF</button>
        <button className="button ghost" onClick={handleLocate}>Locatia mea</button>
        <button className="button ghost" onClick={() => mapRef.current?.setMapTypeId("satellite")}>Satellite</button>
        <button className="button ghost" onClick={() => mapRef.current?.setMapTypeId("hybrid")}>Hybrid</button>
        {selectedParcel && (
          <button className="button secondary" onClick={saveSelectedEdits}>Save edits</button>
        )}
      </div>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={{ lat: 44.3, lng: 26.1 }}
        zoom={15}
        options={mapOptions}
        onLoad={handleLoad}
        onIdle={scheduleFetch}
      >
        <DrawingManager
          onPolygonComplete={handlePolygonComplete}
          drawingMode={drawingMode || undefined}
          options={{
            drawingControl: false,
            polygonOptions: {
              fillColor: "#4dd6a5",
              fillOpacity: 0.2,
              strokeColor: "#4dd6a5",
              strokeWeight: 2,
              editable: true
            }
          }}
        />

        {parcels.map((p) => (
          <Polygon
            key={p.id}
            paths={geojsonToPath(p.geometry)}
            options={{
              fillColor: selectedParcel?.id === p.id ? "#f7b267" : "#4dd6a5",
              fillOpacity: 0.25,
              strokeColor: selectedParcel?.id === p.id ? "#f7b267" : "#4dd6a5",
              strokeWeight: selectedParcel?.id === p.id ? 3 : 2,
              editable: selectedParcel?.id === p.id
            }}
            onLoad={(poly) => {
              polygonRefs.current[p.id] = poly;
            }}
            onUnmount={() => {
              delete polygonRefs.current[p.id];
            }}
            onClick={() => onSelectParcel(p)}
          />
        ))}

      </GoogleMap>

      {showImport && (
        <div className="panel" style={{ position: "absolute", top: 56, right: 16, width: 300, zIndex: 5 }}>
          <div className="small" style={{ marginBottom: 8 }}>Import CF din PDF (Stereo 70) sau Excel/CSV.</div>
          <div className="field">
            <label>CF</label>
            <input value={importCFNumber} onChange={(e) => setImportCFNumber(e.target.value)} placeholder="CF123" />
          </div>
          <div className="field">
            <label>Nume parcela (optional)</label>
            <input value={importParcelName} onChange={(e) => setImportParcelName(e.target.value)} placeholder="Parcela A" />
          </div>
          <div className="field">
            <label>Judet (optional)</label>
            <input value={importCounty} onChange={(e) => setImportCounty(e.target.value)} />
          </div>
          <div className="field">
            <label>Localitate (optional)</label>
            <input value={importLocality} onChange={(e) => setImportLocality(e.target.value)} />
          </div>
          <div className="field">
            <label>PDF CF</label>
            <input type="file" accept=".pdf" onChange={(e) => setImportPdf(e.target.files?.[0] || null)} />
          </div>
          <button className="button" onClick={handleImportPdf} disabled={importBusy}>Import PDF</button>
          <div style={{ height: 10 }} />
          <div className="field">
            <label>Excel/CSV</label>
            <input type="file" accept=".xlsx,.csv" onChange={(e) => setImportExcel(e.target.files?.[0] || null)} />
          </div>
          <button className="button secondary" onClick={handleImportExcel} disabled={importBusy}>Import Excel/CSV</button>
          {importError && <div className="notice" style={{ marginTop: 10 }}>{importError}</div>}
        </div>
      )}

      {draftPolygon && (
        <div className="panel" style={{ position: "absolute", bottom: 16, left: 16, width: 260, zIndex: 5 }}>
          <div className="field">
            <label>Nume parcela</label>
            <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Parcela noua" />
          </div>
          <div className="field">
            <label>CF</label>
            <input value={draftCF} onChange={(e) => setDraftCF(e.target.value)} placeholder="CF123" />
          </div>
          <div className="small">Suprafata: {draftArea.toFixed(0)} m2 / {(draftArea / 10000).toFixed(2)} ha</div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button className="button" onClick={saveDraft}>Salveaza</button>
            <button className="button ghost" onClick={() => { draftPolygon.setMap(null); setDraftPolygon(null); }}>Renunta</button>
          </div>
        </div>
      )}
    </div>
  );
}

function polygonToGeoJSON(polygon: google.maps.Polygon): GeoJSON.Polygon {
  const path = polygon.getPath().getArray().map((p) => [p.lng(), p.lat()]);
  if (path.length > 0) {
    const first = path[0];
    const last = path[path.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      path.push(first);
    }
  }
  return { type: "Polygon", coordinates: [path] };
}

function geojsonToPath(geom: GeoJSON.Polygon) {
  const coords = geom.coordinates[0] || [];
  return coords.map((c) => ({ lat: c[1], lng: c[0] }));
}
