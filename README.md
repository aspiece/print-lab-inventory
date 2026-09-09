# 3D Print Lab Material Inventory

Google-Sheet-backed material inventory for a school 3D printing lab. The app is
now focused on a single workflow: managing printer filament inventory without a
database.

## Stack

- **Frontend**: React + TypeScript + Vite
- **Data source**: Google Sheets
- **Write-back**: Google Apps Script web app

## Inventory sheet columns

Use one sheet tab named `Inventory` with these headers in this order:

- Spool ID
- Material
- Color
- Brand
- Starting Weight (g)
- Estimated Remaining (g)
- Status
- Storage Location
- Loaded Printer
- Date Opened
- Notes
- Low Stock Threshold (g)

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Set these environment variables before local development or deployment:

- `VITE_GOOGLE_SHEET_CSV_URL`: published CSV URL for the inventory sheet
- `VITE_GOOGLE_APPS_SCRIPT_URL`: deployed Google Apps Script web app URL

The frontend can read from the CSV URL alone. Adding, editing, and archiving
rows requires the Apps Script URL.

## GitHub Pages deployment

The frontend is deployed from
`/home/runner/work/print-lab-inventory/print-lab-inventory/.github/workflows/deploy-pages.yml`.

Before the hosted site will work end-to-end:

1. Publish the Google Sheet tab as CSV and set `VITE_GOOGLE_SHEET_CSV_URL`.
2. Deploy the script in
   `/home/runner/work/print-lab-inventory/print-lab-inventory/google-apps-script/inventory-web-app.gs`.
3. Set `VITE_GOOGLE_APPS_SCRIPT_URL` to the deployed web app URL.
4. Push to `main` or run the workflow manually from the Actions tab.

The workflow builds the Vite app, publishes `frontend/dist`, and copies
`index.html` to `404.html` for SPA route fallback on GitHub Pages.

## Google Apps Script setup

A starter Apps Script web app is included at
`/home/runner/work/print-lab-inventory/print-lab-inventory/google-apps-script/inventory-web-app.gs`.

It supports:

- listing sheet rows
- creating a spool with an auto-incremented `Spool ID`
- updating a spool by `Spool ID`
- archiving a spool by setting `Status` to `Archived`
