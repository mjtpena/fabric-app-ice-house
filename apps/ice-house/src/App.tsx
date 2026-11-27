import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '@x10/shared/runtime';

import { AboutPage } from './pages/AboutPage';
import { DoorLogPage } from './pages/DoorLogPage';
import { FefoPickPage } from './pages/FefoPickPage';
import { HomePage } from './pages/HomePage';
import { MeltLedgerPage } from './pages/MeltLedgerPage';
import { ThawTablePage } from './pages/ThawTablePage';
import { ThermometerPage } from './pages/ThermometerPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell immersive><HomePage /></AppShell>} />
      <Route path="/door-log" element={<AppShell><DoorLogPage /></AppShell>} />
      <Route path="/thermometer" element={<AppShell><ThermometerPage /></AppShell>} />
      <Route path="/thaw" element={<AppShell><ThawTablePage /></AppShell>} />
      <Route path="/fefo" element={<AppShell><FefoPickPage /></AppShell>} />
      <Route path="/melt-ledger" element={<AppShell><MeltLedgerPage /></AppShell>} />
      <Route path="/about" element={<AppShell><AboutPage /></AppShell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
