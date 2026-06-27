// Mapa explícito de iconos para permitir tree-shaking (evita `import * as LucideIcons`,
// que incluiría los ~1500 iconos de lucide en el bundle).
import {
  ShoppingCart, Coffee, Home, Car, Zap, Droplet, Wifi, Smartphone,
  Gift, Heart, Plane, Train, Bus, Briefcase, CreditCard, DollarSign,
  TrendingUp, TrendingDown, Activity, Award, Book, Camera, Music,
  Video, Monitor, Headphones, Watch, Scissors, PenTool, Shield, Key,
  Lock, Unlock, Umbrella, Sun, Moon, Cloud, Star, Tag, Smile,
  type LucideIcon,
} from 'lucide-react';

// Claves en kebab-case (las que se guardan en Categoria.icono).
export const ICON_MAP: Record<string, LucideIcon> = {
  'shopping-cart': ShoppingCart,
  'coffee': Coffee,
  'home': Home,
  'car': Car,
  'zap': Zap,
  'droplet': Droplet,
  'wifi': Wifi,
  'smartphone': Smartphone,
  'gift': Gift,
  'heart': Heart,
  'plane': Plane,
  'train': Train,
  'bus': Bus,
  'briefcase': Briefcase,
  'credit-card': CreditCard,
  'dollar-sign': DollarSign,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'activity': Activity,
  'award': Award,
  'book': Book,
  'camera': Camera,
  'music': Music,
  'video': Video,
  'monitor': Monitor,
  'headphones': Headphones,
  'watch': Watch,
  'scissors': Scissors,
  'tool': PenTool,
  'shield': Shield,
  'key': Key,
  'lock': Lock,
  'unlock': Unlock,
  'umbrella': Umbrella,
  'sun': Sun,
  'moon': Moon,
  'cloud': Cloud,
  'star': Star,
  'tag': Tag,
  'smile': Smile,
};

export const ICON_NAMES = Object.keys(ICON_MAP);

export function getIcon(name?: string): LucideIcon {
  return (name && ICON_MAP[name]) || Tag;
}
