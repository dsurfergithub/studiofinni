import React, { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

type ToastTipo = 'ok' | 'error' | 'info';

interface ToastItem {
  id: number;
  tipo: ToastTipo;
  mensaje: string;
}

interface ToastContextType {
  toast: (mensaje: string, tipo?: ToastTipo) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const ICONOS: Record<ToastTipo, typeof Info> = {
  ok: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const DURACION_MS = 4000;
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const cerrar = useCallback((id: number) => {
    setItems(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((mensaje: string, tipo: ToastTipo = 'info') => {
    const id = nextId++;
    setItems(prev => [...prev.slice(-2), { id, tipo, mensaje }]);
    setTimeout(() => cerrar(id), DURACION_MS);
  }, [cerrar]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Contenedor de avisos: por encima de sheets (z-50) y nav */}
      <div className="fixed top-0 left-0 right-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pointer-events-none">
        {items.map(t => {
          const Icon = ICONOS[t.tipo];
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                'pointer-events-auto w-full max-w-sm flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-lg animate-toast-in',
                t.tipo === 'ok' && 'bg-success-soft border-success/40 text-success',
                t.tipo === 'error' && 'bg-danger-soft border-danger/40 text-danger',
                t.tipo === 'info' && 'bg-surface-elevated/95 border-border text-text',
              )}
            >
              <Icon size={18} className="flex-shrink-0 mt-0.5" />
              <p className="flex-1 text-sm font-bold leading-snug text-text">{t.mensaje}</p>
              <button onClick={() => cerrar(t.id)} className="text-muted hover:text-text flex-shrink-0" aria-label="Cerrar aviso">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
}
