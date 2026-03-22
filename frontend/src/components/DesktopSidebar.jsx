import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, Clapperboard, FolderOpen, Settings } from 'lucide-react';

export default function DesktopSidebar({ onOpenSettings }) {
  const location = useLocation();
  const nav = useNavigate();

  const match = location.pathname.match(/^\/project\/([^/]+)/);
  const pid = match?.[1] || null;

  const mainItems = [
    {
      key: 'projects',
      label: '项目',
      icon: Home,
      active: location.pathname === '/',
      onClick: () => nav('/'),
      disabled: false,
    },
    {
      key: 'characters',
      label: '角色',
      icon: Users,
      active: location.pathname.includes('/workshop'),
      onClick: () => pid && nav(`/project/${pid}/workshop`),
      disabled: !pid,
    },
    {
      key: 'studio',
      label: '演播室',
      icon: Clapperboard,
      active: location.pathname.includes('/studio'),
      onClick: () => pid && nav(`/project/${pid}/studio`),
      disabled: !pid,
    },
    {
      key: 'assets',
      label: '资产库',
      icon: FolderOpen,
      active: location.pathname.includes('/assets'),
      onClick: () => pid && nav(`/project/${pid}/assets`),
      disabled: !pid,
    }
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[92px] border-r border-white/30 bg-gradient-to-b from-white/65 via-white/45 to-white/35 backdrop-blur-xl dark:border-[#2c2c2c] dark:bg-gradient-to-b dark:from-[#171717] dark:via-[#151515] dark:to-[#121212]">
      <div className="flex h-full flex-col items-center py-4">
        <div className="mb-6 flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-[0_10px_24px_rgba(31,41,55,0.16)] ring-1 ring-slate-200/80 dark:bg-[#f3f3f3] dark:ring-[#ffffffcc]">
          <img
            src="/narratis-favicon.png"
            alt="Narratis"
            className="h-full w-full object-contain p-1.5"
          />
        </div>

        <div className="flex w-full flex-1 flex-col items-center gap-3">
        {mainItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={item.onClick}
              disabled={item.disabled}
              title={item.disabled ? `${item.label}（请先进入项目）` : item.label}
              className={`group relative flex h-12 w-12 items-center justify-center rounded-xl border transition-all ${
                item.active
                  ? 'border-[#D3BC8E]/80 bg-[#D3BC8E]/35 text-[#3B4255] shadow-md dark:border-[#8f7a54] dark:bg-[#3a3223] dark:text-[#f0dfba]'
                  : 'border-transparent bg-white/55 text-[#475569] hover:border-[#D3BC8E]/50 hover:bg-white/90 dark:bg-[#1c1c1c] dark:text-[#b7b7b7] dark:hover:border-[#565656] dark:hover:bg-[#262626]'
              } ${item.disabled ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              <Icon size={20} />
              <span className="pointer-events-none absolute left-[62px] whitespace-nowrap rounded-lg border border-white/50 bg-white/90 px-2 py-1 text-[11px] font-semibold text-[#334155] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 dark:border-[#3a3a3a] dark:bg-[#111111] dark:text-[#e5e5e5]">
                {item.label}
              </span>
            </button>
          );
        })}
        </div>

        <button
          onClick={onOpenSettings}
          title="设置"
          className="group relative mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-transparent bg-white/55 text-[#475569] transition-all hover:border-[#D3BC8E]/50 hover:bg-white/90 dark:bg-[#1c1c1c] dark:text-[#b7b7b7] dark:hover:border-[#565656] dark:hover:bg-[#262626]"
        >
          <Settings size={20} />
          <span className="pointer-events-none absolute left-[62px] whitespace-nowrap rounded-lg border border-white/50 bg-white/90 px-2 py-1 text-[11px] font-semibold text-[#334155] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 dark:border-[#3a3a3a] dark:bg-[#111111] dark:text-[#e5e5e5]">
            设置
          </span>
        </button>
      </div>
    </aside>
  );
}
