import {
  LayoutDashboard,
  Upload,
  Target,
  ClipboardCheck,
  type LucideProps,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<LucideProps>;
  /** Show in the mobile bottom tab bar (limited slots). */
  primary: boolean;
}

/**
 * Navigation model. `primary` items appear in the mobile bottom tab bar;
 * the rest stay reachable from the desktop sidebar (Review is also reached
 * from the import flow). Exported so page agents can reference the route map.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, primary: true },
  { to: '/import', label: 'Import', icon: Upload, primary: true },
  { to: '/coach', label: 'Coach', icon: Target, primary: true },
  { to: '/review', label: 'Review', icon: ClipboardCheck, primary: false },
];
