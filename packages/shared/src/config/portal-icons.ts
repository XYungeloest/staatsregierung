import House from '@lucide/astro/icons/house';
import Search from '@lucide/astro/icons/search';
import Menu from '@lucide/astro/icons/menu';
import Scale from '@lucide/astro/icons/scale';
import Files from '@lucide/astro/icons/files';
import MapIcon from '@lucide/astro/icons/map';
import Wallet from '@lucide/astro/icons/wallet';
import Landmark from '@lucide/astro/icons/landmark';
import Building from '@lucide/astro/icons/building';
import Newspaper from '@lucide/astro/icons/newspaper';
import Mail from '@lucide/astro/icons/mail';
import Phone from '@lucide/astro/icons/phone';
import Rss from '@lucide/astro/icons/rss';
import CalendarDays from '@lucide/astro/icons/calendar-days';
import BookOpenText from '@lucide/astro/icons/book-open-text';
import Hand from '@lucide/astro/icons/hand';
import Accessibility from '@lucide/astro/icons/accessibility';
import ArrowRight from '@lucide/astro/icons/arrow-right';
import ChevronDown from '@lucide/astro/icons/chevron-down';

import GraduationCap from '@lucide/astro/icons/graduation-cap';
import HeartPulse from '@lucide/astro/icons/heart-pulse';
import Factory from '@lucide/astro/icons/factory';
import TrainFront from '@lucide/astro/icons/train-front';
import Leaf from '@lucide/astro/icons/leaf';
import Globe from '@lucide/astro/icons/globe';
import Theater from '@lucide/astro/icons/theater';

export const portalIcons = {
  home: House, search: Search, menu: Menu, law: Scale, topics: Files, map: MapIcon,
  budget: Wallet, government: Landmark, ministry: Building, press: Newspaper,
  contact: Mail, phone: Phone, rss: Rss, calendar: CalendarDays,
  'easy-language': BookOpenText, 'sign-language': Hand, accessibility: Accessibility,
  arrow: ArrowRight, disclosure: ChevronDown, education: GraduationCap, health: HeartPulse,
  industry: Factory, mobility: TrainFront, environment: Leaf, culture: Theater, international: Globe,
} as const;

export type PortalIconName = keyof typeof portalIcons;

const ministryIcons: Readonly<Record<string, PortalIconName>> = {
  'bildung-und-sportliche-ertuechtigung': 'education',
  'inneres-bau-und-kommunale-angelegenheiten': 'map',
  'kapitalakkumulation-des-fiskus': 'budget',
  'kultur-medien-und-kulturelle-emanzipation': 'culture',
  'mobilitaet-infrastruktur-und-landesentwicklung': 'mobility',
  'rechtsstaatlichkeit-und-angelegenheiten-des-staates': 'law',
  'soziale-und-gesundheitliche-fuersorge': 'health',
  staatskanzlei: 'government',
  'umwelt-energie-und-klimaschutz': 'environment',
  'voelkerfreundschaft-und-nachbarschaftspolitik': 'international',
  'wirtschaft-arbeitsmarkt-und-beschaeftigung': 'industry',
};

export function ministryIcon(slug: string): PortalIconName {
  return ministryIcons[slug] ?? 'ministry';
}
