import React, { useMemo, useState } from "react";
import ParcelForm from "./ParcelForm";
import WorkForm from "./WorkForm";
import HarvestForms from "./HarvestForms";
import SoilForm from "./SoilForm";
import CropHistory from "./CropHistory";
import NDVITimeSeries from "./NDVITimeSeries";
import ApplicationForm from "./ApplicationForm";

import { ParcelFeature } from "./MapView";

type ParcelSidebarProps = {
  parcel: ParcelFeature | null;
  onParcelUpdated: (p: ParcelFeature) => void;
};

const tabs = [
  "Detalii",
  "Lucrari",
  "Culturi & Soiuri",
  "Aplicari",
  "Recolte",
  "Analize sol",
  "NDVI"
];

export default function ParcelSidebar({ parcel, onParcelUpdated }: ParcelSidebarProps) {
  const [active, setActive] = useState(tabs[0]);

  const title = useMemo(() => {
    if (!parcel) return "Selecteaza o parcela";
    return `${parcel.name} · ${parcel.cf_number || "CF"}`;
  }, [parcel]);

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {!parcel && <div className="notice">Click pe o parcela pentru detalii.</div>}
      {parcel && (
        <>
          <div className="tabs">
            {tabs.map((t) => (
              <div
                key={t}
                className={`tab ${active === t ? "active" : ""}`}
                onClick={() => setActive(t)}
              >
                {t}
              </div>
            ))}
          </div>

          {active === "Detalii" && (
            <ParcelForm parcel={parcel} onParcelUpdated={onParcelUpdated} />
          )}
          {active === "Lucrari" && <WorkForm parcelId={parcel.id} />}
          {active === "Culturi & Soiuri" && <CropHistory parcelId={parcel.id} />}
          {active === "Aplicari" && <ApplicationForm parcelId={parcel.id} />}
          {active === "Recolte" && <HarvestForms parcelId={parcel.id} />}
          {active === "Analize sol" && <SoilForm parcelId={parcel.id} />}
          {active === "NDVI" && <NDVITimeSeries parcelId={parcel.id} />}
        </>
      )}
    </div>
  );
}
