import React from 'react';
import * as LucideIcons from 'lucide-react';

const COMMON_ICONS = [
  'shopping-cart', 'coffee', 'home', 'car', 'zap', 'droplet', 'wifi', 'smartphone',
  'gift', 'heart', 'plane', 'train', 'bus', 'briefcase', 'credit-card', 'dollar-sign',
  'trending-up', 'trending-down', 'activity', 'award', 'book', 'camera', 'music',
  'video', 'monitor', 'headphones', 'watch', 'scissors', 'tool', 'shield', 'key',
  'lock', 'unlock', 'umbrella', 'sun', 'moon', 'cloud', 'star', 'tag', 'smile'
];

interface IconPickerProps {
  value?: string;
  onChange: (iconName: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {COMMON_ICONS.map((name) => {
        // Convert kebab-case to PascalCase
        const pascalName = name.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
        const Icon = (LucideIcons as any)[pascalName] || LucideIcons.HelpCircle;
        
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
