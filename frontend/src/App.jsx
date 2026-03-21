import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CreateProject from './pages/CreateProject';
import Workshop from './pages/Workshop';
import Studio from './pages/Studio';
import DesktopSidebar from './components/DesktopSidebar';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const [showSettings, setShowSettings] = React.useState(false);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_20%_-10%,#fff8ea_0%,#f1f5f9_40%,#e8edf3_100%)] text-slate-800">
        <DesktopSidebar onOpenSettings={() => setShowSettings(true)} />
        <SettingsModal open={showSettings} close={() => setShowSettings(false)} />
        <div className="pl-[92px]">
          <Routes>
            <Route path="/" element={<CreateProject />} />
            {/* URL带上 projectId，方便刷新后保持状态 */}
            <Route path="/project/:pid/workshop" element={<Workshop />} />
            <Route path="/project/:pid/studio" element={<Studio />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
