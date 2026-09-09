import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";

import { Dashboard } from "./pages/Dashboard";
import { Inventory } from "./pages/Inventory";
import { Machines } from "./pages/Machines";
import { PrintRequests } from "./pages/PrintRequests";
import { SpoolDetail } from "./pages/SpoolDetail";

const baseName =
  import.meta.env.BASE_URL !== "/"
    ? import.meta.env.BASE_URL.replace(/\/$/, "")
    : undefined;

export default function App() {
  return (
    <BrowserRouter basename={baseName}>
      <div className="app-shell">
        <header className="site-header">
          <div>
            <p className="eyebrow">3D Print Lab</p>
            <h1>Inventory</h1>
          </div>
          <nav className="nav-links">
            <NavLink to="/">Dashboard</NavLink>
            <NavLink to="/inventory">Inventory</NavLink>
            <NavLink to="/machines">Machines</NavLink>
            <NavLink to="/requests">Requests</NavLink>
          </nav>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/spools/:id" element={<SpoolDetail />} />
            <Route path="/machines" element={<Machines />} />
            <Route path="/requests" element={<PrintRequests />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
