import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CreateProject from './pages/CreateProject';
import Workshop from './pages/Workshop';
import Studio from './pages/Studio';
import AssetsLibrary from './pages/AssetsLibrary';
import DesktopSidebar from './components/DesktopSidebar';
import SettingsModal from './components/SettingsModal';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const [showSettings, setShowSettings] = React.useState(false);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#eef2f6] text-slate-800 dark:bg-[#111111]">
        <DesktopSidebar onOpenSettings={() => setShowSettings(true)} />
        <ErrorBoundary>
          <SettingsModal open={showSettings} close={() => setShowSettings(false)} />
        </ErrorBoundary>
        <div className="pl-[92px]">
          <Routes>
            <Route path="/" element={<CreateProject />} />
            {/* URL带上 projectId，方便刷新后保持状态 */}
            <Route path="/project/:pid/workshop" element={<Workshop />} />
            <Route path="/project/:pid/studio" element={<Studio />} />
            <Route path="/project/:pid/assets" element={<AssetsLibrary />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
