import {
  BanknoteArrowUp,
  CalendarCheck,
  ClipboardList,
  IndianRupee,
  LayoutDashboard,
  ScrollText,
  Users,
  UsersRound,
} from 'lucide-react';

/**
 * One list drives both the sidebar and the route table, so a link can never
 * point at a route that does not exist.
 *
 * `ready: false` means the screen is planned but not built yet - it renders a
 * placeholder rather than disappearing, so the shape of the finished app is
 * visible from the start.
 */
export const NAV_ITEMS = [
  { path: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, adminOnly: false, ready: true },
  { path: '/collect', labelKey: 'nav.collect', icon: BanknoteArrowUp, adminOnly: false, ready: false },
  { path: '/classwise', labelKey: 'nav.classwise', icon: CalendarCheck, adminOnly: false, ready: false },
  { path: '/defaulters', labelKey: 'nav.defaulters', icon: ClipboardList, adminOnly: false, ready: false },
  { path: '/roster', labelKey: 'nav.roster', icon: UsersRound, adminOnly: true, ready: false },
  { path: '/structure', labelKey: 'nav.structure', icon: IndianRupee, adminOnly: true, ready: false },
  { path: '/users', labelKey: 'nav.users', icon: Users, adminOnly: true, ready: false },
  { path: '/audit', labelKey: 'nav.audit', icon: ScrollText, adminOnly: true, ready: false },
];

export function visibleNavItems(isAdmin) {
  return NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
}
