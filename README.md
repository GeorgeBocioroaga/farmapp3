# FarmApp3 — Management Ferma (MVP)

Aplicatie web on‑prem pentru gestionarea fermelor agricole: harta Google Satellite, parcele, import CF PDF, registru lucrari, stocuri, recoltare, analize sol, OCR, NDVI (placeholder).

## Cerinte

- Docker + Docker Compose
- Cheie Google Maps JavaScript API (obligatoriu)

## Configurare .env

Editeaza `.env` si seteaza cheia:

```
GOOGLE_MAPS_API_KEY=REPLACE_ME
```

Poti lasa restul valorilor implicite pentru testare locala.

## Pornire

```
docker compose up -d --build
```

Acces: `http://localhost/`

## Login implicit

- user: `admin`
- pass: `admin`

## Fluxuri principale (MVP)

1) Login → harta porneste in SATELLITE. Deseneaza o parcela si salveaza.
2) Import CF PDF: foloseste endpoint-ul `/api/cf/import` (form data + file) din Postman/curl.
3) Lucrari: selecteaza parcela → tab Lucrari → adauga lucrare (motorina/ha, cost).
4) Stocuri: tab Stocuri → adauga erbicid/ingrasamant/motorina/cereale.
5) OCR eticheta: tab Stocuri → upload eticheta (OCR extrage substante active).
6) Recoltare: tab Recolte → adauga recoltare + upload bon siloz (OCR).
7) Analize sol: tab Analize sol → adauga parametri (pH, N, P, K, humus).

## Seed

In containerul API:

```
python seed.py
```

Creeaza admin + catalog culturi (grau, porumb, floarea-soarelui, rapita, orz, orzoaica, soia, triticale, mazare, lucerna) si cateva soiuri.

## Note licentiere Google

- Nu cache-ui sau redistribui tile-urile Google.
- Harta de baza este Google Maps SATELLITE; overlay-urile (parcele, NDVI) sunt ale aplicatiei.

## Endpoints cheie (MVP)

- `POST /api/auth/login`
- `POST /api/cf/import` (PDF)
- `POST /api/cf/import-excel` (CSV/XLSX)
- `GET/POST/PATCH /api/parcels`
- `POST /api/parcels/{id}/works`
- `POST /api/ocr/label`
- `POST /api/mix/check`
- `POST /api/harvests` + `POST /api/harvests/{id}/ticket`
- `POST /api/soil-analyses`
- `POST /api/raster/ingest`

## Definition of Done (manual)

1) Login OK.
2) Harta porneste in SATELLITE cu zoom clar si parcele vizibile.
3) Desen parcela → salveaza → refresh si reapare.
4) Import PDF CF → poligon in harta.
5) OCR eticheta → substante active extrase.
6) Adaugare lucrare cu consum motorina.
7) Recoltare + bon siloz OCR.
8) Cost/ha si productie/ha afisate in tab Detalii.
9) RBAC de baza (admin/operator).
