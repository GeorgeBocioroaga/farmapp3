import React from "react";

type NDVITimeSeriesProps = {
  parcelId: number;
};

export default function NDVITimeSeries({ parcelId }: NDVITimeSeriesProps) {
  return (
    <div>
      <div className="notice">NDVI indisponibil pentru parcela selectata.</div>
      <p className="small">Cand sunt ingestate rasters Sentinel-2, aici apare graficul de vigoare.</p>
    </div>
  );
}
