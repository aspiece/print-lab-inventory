import { Inventory } from "./pages/Inventory";

export default function App() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="stack-xs">
          <p className="eyebrow">3D Print Lab</p>
          <h1>Material Inventory</h1>
          <p className="muted">
            Google Sheet-backed spool tracking with no database.
          </p>
        </div>
      </header>
      <main>
        <Inventory />
      </main>
    </div>
  );
}
