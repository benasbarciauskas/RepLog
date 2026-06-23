import {
  LayoutDashboard,
  Dumbbell,
  Target,
  Upload,
  ListChecks,
  History,
  TrendingUp,
  ClipboardCheck,
  CalendarRange,
  Settings,
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
 * the rest stay reachable from the desktop sidebar and an "More" overflow sheet
 * on mobile. Exported as the shared route map for navigation UI.
 *
 * Mobile primary tabs (4 + a centred Log action): Dashboard, Coach, [Log],
 * History, More. Log gets the prominent centre slot (the core v1.1 action).
 * Import, Routines and Review live in the desktop sidebar / mobile overflow.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, primary: true },
  { to: '/log', label: 'Log', icon: Dumbbell, primary: true },
  { to: '/coach', label: 'Coach', icon: Target, primary: true },
  { to: '/history', label: 'History', icon: History, primary: true },
  { to: '/trends', label: 'Trends', icon: TrendingUp, primary: false },
  { to: '/routines', label: 'Routines', icon: ListChecks, primary: false },
  { to: '/program', label: 'Program', icon: CalendarRange, primary: false },
  { to: '/import', label: 'Import', icon: Upload, primary: false },
  { to: '/review', label: 'Review', icon: ClipboardCheck, primary: false },
  { to: '/settings', label: 'Settings', icon: Settings, primary: false },
];

/** The route that gets the prominent centre slot in the mobile bottom nav. */
export const PRIMARY_ACTION_TO = '/log';
