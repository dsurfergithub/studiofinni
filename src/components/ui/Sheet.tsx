import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { playSheetOpen, playSheetClose } from '../../lib/audio/sounds';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Sheet({ isOpen, onClose, title, children }: SheetProps) {
  const [render, setRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setRender(true);
      playSheetOpen();
      document.body.style.overflow = 'hidden';
    } else {
      if (render) playSheetClose();
      document.body.style.overflow = '';
      const t = setTimeout(() => setRender(false), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!render) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pb-0">
      {/* Backdrop */}
      <div 
        className={cn(
          "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300", 
          isOpen ? "opacity-100" : "opacity-0"
        )} 
        onClick={onClose} 
      />
      
      {/* Content */}
      <div 
        className={cn(
          "relative w-full max-w-lg bg-surface border-t sm:border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col transition-transform duration-300 ease-out sm:max-h-[85vh]",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
        style={{ maxHeight: '90dvh' }}
      >
        <div className="flex-shrink-0 flex items-center justify-between p-5 pb-3">
          <h2 className="text-xl font-display font-semibold truncate pr-8">{title}</h2>
          <button 
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-surface-elevated text-muted hover:text-text transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 pt-2 custom-scrollbar pb-safe">
          {children}
        </div>
      </div>
    </div>
  );
}
