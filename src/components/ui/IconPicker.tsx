import React from 'react';
import { ICON_NAMES, getIcon } from '../../lib/icons';

interface IconPickerProps {
  value?: string;
  onChange: (iconName: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {ICON_NAMES.map((name) => {
        const Icon = getIcon(name);
        return (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            className={`flex items-center justify-center p-3 rounded-xl transition-colors ${
              value === name ? 'bg-accent/20 text-accent border border-accent' : 'bg-surface-elevated text-muted hover:text-text border border-transparent'
            }`}
          >
            <Icon size={24} />
          </button>
        );
      })}
    </div>
  );
}
