import {
  Beef,
  Bird,
  Rabbit,
  ClipboardCheck,
  FileWarning,
  Award,
  Users,
  CookingPot,
  Utensils,
  ShieldAlert,
  Factory,
  FolderOpen,
  PackageOpen,
  Truck,
  Import,
  Upload,
  ListChecks,
  FlaskConical,
  Stamp,
  Files,
} from 'lucide-react';
import type { RubricId } from '@/lib/canevas';

const icons = {
  'I.A.1': Beef,
  'I.A.2': Stamp,
  'I.A.3': Bird,
  'I.A.4': Rabbit,
  'I.A.5': ClipboardCheck,
  'I.A.6': FileWarning,
  'I.A.7': Award,
  'I.B.1': Users,
  'I.B.2': Files,
  'I.C.1': CookingPot,
  'I.C.2': Utensils,
  'I.D': ShieldAlert,
  'II.A': Factory,
  'II.B': FolderOpen,
  'II.C': PackageOpen,
  III: Truck,
  IV: Import,
  V: Upload,
  'VI.A': ListChecks,
  'VI.B': FlaskConical,
};

export default function RubricIcon({
  id,
  size = 19,
}: {
  id: string;
  size?: number;
}) {
  const Icon = icons[id as RubricId] ?? ClipboardCheck;
  return <Icon size={size} aria-hidden="true" className="shrink-0" />;
}
