import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CreateProject from './pages/CreateProject';
import Workshop from './pages/Workshop';
import Studio from './pages/Studio';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#f8f9fa] text-slate-800">
        <Routes>
          <Route path="/" element={<CreateProject />} />
          {/* URL带上 projectId，方便刷新后保持状态 */}
          <Route path="/project/:pid/workshop" element={<Workshop />} />
          <Route path="/project/:pid/studio" element={<Studio />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}