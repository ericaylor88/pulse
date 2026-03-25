import { NavItem } from '@/types';

// Pulse navigation — maps to build phases
// Phase 1: Daily Briefing, Check-in
// Phase 2: Trends, Body Comp, Blood Work
// Phase 3: Correlations, Recommendations
// Phase 4+: Settings

export const navItems: NavItem[] = [
  {
    title: 'Daily Briefing',
    url: '/dashboard/overview',
    icon: 'dashboard',
    isActive: false,
    shortcut: ['d', 'd'],
    items: []
  },
  {
    title: 'Check-in',
    url: '/dashboard/check-in',
    icon: 'check',
    isActive: false,
    shortcut: ['c', 'c'],
    items: []
  },
  {
    title: 'Trends',
    url: '/dashboard/trends',
    icon: 'chart',
    isActive: false,
    shortcut: ['t', 't'],
    items: []
  },
  {
    title: 'Body Composition',
    url: '/dashboard/body-comp',
    icon: 'user',
    isActive: false,
    items: []
  },
  {
    title: 'Blood Work',
    url: '/dashboard/blood-work',
    icon: 'heart',
    isActive: false,
    items: []
  },
  {
    title: 'Correlations',
    url: '/dashboard/correlations',
    icon: 'analytics',
    isActive: false,
    shortcut: ['r', 'r'],
    items: []
  },
  {
    title: 'Recommendations',
    url: '/dashboard/recommendations',
    icon: 'bulb',
    isActive: false,
    items: []
  },
  {
    title: 'Health',
    url: '#',
    icon: 'shield',
    isActive: true,
    items: [
      {
        title: 'Supplements',
        url: '/dashboard/supplements',
        icon: 'pill'
      },
      {
        title: 'Illness Log',
        url: '/dashboard/illness-log',
        icon: 'warning'
      },
      {
        title: 'Genetic Profile',
        url: '/dashboard/genetics',
        icon: 'dna'
      }
    ]
  },
  {
    title: 'Settings',
    url: '/dashboard/settings',
    icon: 'settings',
    isActive: false,
    shortcut: ['s', 's'],
    items: []
  }
];
