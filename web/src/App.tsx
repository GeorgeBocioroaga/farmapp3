import React, { useState } from "react";
import Header from "./components/Header";
import Login from "./components/Login";
import MapView, { ParcelFeature } from "./components/MapView";
import ParcelSidebar from "./components/ParcelSidebar";
import HerbicideModule from "./components/HerbicideModule";
import { clearSession, getUser } from "./auth";

export default function App() {
  const [user, setUser] = useState(getUser());
  const [parcels, setParcels] = useState<ParcelFeature[]>([]);
  const [selected, setSelected] = useState<ParcelFeature | null>(null);
  const [activeView, setActiveView] = useState<"parcels" | "inventory">("parcels");

  const handleLogout = () => {
    clearSession();
    setUser(null);
  };

  const handleParcelCreated = (parcel: ParcelFeature) => {
    setParcels((prev) => [...prev, parcel]);
  };

  const handleParcelUpdated = (parcel: ParcelFeature) => {
    setParcels((prev) => prev.map((p) => (p.id === parcel.id ? parcel : p)));
    setSelected(parcel);
  };

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="app">
      <Header user={user} onLogout={handleLogout} activeView={activeView} onViewChange={setActiveView} />
      {activeView === "parcels" && (
        <div className="main">
          <MapView
            parcels={parcels}
            setParcels={setParcels}
            selectedParcel={selected}
            onSelectParcel={setSelected}
            onParcelCreated={handleParcelCreated}
            onParcelUpdated={handleParcelUpdated}
          />
          <ParcelSidebar parcel={selected} onParcelUpdated={handleParcelUpdated} />
        </div>
      )}
      {activeView === "inventory" && (
        <div className="main single">
          <HerbicideModule />
        </div>
      )}
    </div>
  );
}
