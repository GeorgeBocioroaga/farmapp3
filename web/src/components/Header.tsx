import React from "react";

type HeaderProps = {
  user: { name: string; role: string } | null;
  onLogout: () => void;
  activeView?: "parcels" | "inventory";
  onViewChange?: (v: "parcels" | "inventory") => void;
};

export default function Header({ user, onLogout, activeView, onViewChange }: HeaderProps) {
  return (
    <header className="header">
      <h1>FarmApp3 · Management Ferma</h1>
      <div className="header-nav">
        <button
          className={`button ghost ${activeView === "parcels" ? "active" : ""}`}
          onClick={() => onViewChange?.("parcels")}
        >
          Parcele
        </button>
        <button
          className={`button ghost ${activeView === "inventory" ? "active" : ""}`}
          onClick={() => onViewChange?.("inventory")}
        >
          Stocuri
        </button>
      </div>
      <div className="user">
        {user ? (
          <>
            {user.name} ({user.role})
            <button className="button ghost" style={{ marginLeft: 12 }} onClick={onLogout}>
              Logout
            </button>
          </>
        ) : (
          "Neautentificat"
        )}
      </div>
    </header>
  );
}
