import React from 'react';
import { Home, List, Wallet, BarChart2, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { playClick } from '../../lib/audio/sounds';

interface BottomNavProps {
  current: string;
  onChange: (tab: string) => void;
}

const TABS = [
  { id: 'dashboard', icon: Home, label: 'Inicio' },
  { id: 'movimientos', icon: List, label: 'Movs' },
  { id: 'presupuesto', icon: Wallet, label: 'Presup.' },
  { id: 'insights', icon: BarChart2, label: 'Insights' },
  { id: 'ajustes', icon: Settings, label: 'Ajustes' },
];

export function BottomNav({ current, onChange }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-xl border-t border-border z-40 pb-[var(--safe-bottom)]">
      <div className="flex justify-around items-center h-[62px] px-2 max-w-md mx-auto">
        {TABS.map((t) => {
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
              className="flex flex-col items-center justify-center flex-1 h-full gap-1"
            >
              <span
                className={cn(
                  'flex items-center justify-center rounded-full px-4 py-1 transition-all duration-200',
                  active ? 'bg-accent/15 text-accent' : 'text-muted'
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.6 : 2} />
              </span>
              <span className={cn('text-[10px] font-bold tracking-wide leading-none', active ? 'text-accent' : 'text-muted')}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
