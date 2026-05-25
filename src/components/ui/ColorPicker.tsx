import React from 'react';
import { PALETA_COLORES } from '../../lib/colors';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="grid grid-cols-6 gap-2 sm:gap-3">
      {PALETA_COLORES.map((hex) => (
        <button
          key={hex}
          type="button"
          onClick={() => onChange(hex)}
          className={`w-full aspect-square rounded-full transition-transform ${value === hex ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-bg' : 'scale-100 hover:scale-105'}`}
          style={{ backgroundColor: hex }}
        />
      ))}
    </div>
  );
}
