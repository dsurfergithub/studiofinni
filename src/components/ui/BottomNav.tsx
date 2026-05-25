import React from 'react';
import { Home, List, PieChart, Tag, Settings, BarChart2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { playClick } from '../../lib/audio/sounds';

interface BottomNavProps {
  current: string;
  onChange: (tab: string) => void;
}

export function BottomNav({ current, onChange }: BottomNavProps) {
  const tabs = [
    { id: 'dashboard', icon: Home, label: 'Resumen' },
    { id: 'movimientos', icon: List, label: 'Movs' },
    { id: 'presupuesto', icon: PieChart, label: 'Presup.' },
    { id: 'insights', icon: BarChart2, label: 'Insights' },
    { id: 'categorias', icon: Tag, label: 'Cats' },
    { id: 'ajustes', icon: Settings, label: 'Ajustes' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-md border-t border-border z-40 pb-[var(--safe-bottom)]">
      <div className="flex justify-around items-center h-[60px] px-1 max-w-lg mx-auto relative">
        {tabs.map((t) => {
          const active = current === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => {
                if (!active) {
                  playClick();
                  onChange(t.id);
                }
              }}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full transition-colors",
                active ? "text-accent" : "text-muted hover:text-text"
              )}
            >
              <Icon size={22} strokeWidth={active ? 3 : 2} className="mb-1" />
              <span className="text-[9px] font-bold uppercase tracking-widest leading-none">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
