import type { CutoffSettings, DayHours, OperatingHoursSettings } from '../types';

/** Horaires par défaut — Lundi à vendredi 8h-19h, samedi 9h-18h, dimanche fermé */
export const DEFAULT_OPERATING_HOURS: OperatingHoursSettings = {
  monday: { open: '08:00', close: '19:00' },
  tuesday: { open: '08:00', close: '19:00' },
  wednesday: { open: '08:00', close: '19:00' },
  thursday: { open: '08:00', close: '19:00' },
  friday: { open: '08:00', close: '19:00' },
  saturday: { open: '09:00', close: '18:00' },
  sunday: { open: '00:00', close: '00:00', closed: true },
};

/** Cutoffs par défaut */
export const DEFAULT_CUTOFFS: CutoffSettings = {
  weekday: '17:30',
  saturday: '17:00',
};

const DAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export type DayKey = (typeof DAY_KEYS)[number];

/** Convertit "HH:mm" en minutes depuis minuit */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** Formate des minutes en "HH:mm" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Formate un créneau pour affichage (ex: "08h00 – 10h00") */
export function formatSlotLabel(startMinutes: number, endMinutes: number): string {
  const fmt = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
  };
  return `${fmt(startMinutes)} – ${fmt(endMinutes)}`;
}

/** Retourne la clé du jour pour une date donnée */
export function getDayKey(date: Date): DayKey {
  return DAY_KEYS[date.getDay()] as DayKey;
}

/** Retourne les horaires du jour pour une date */
export function getDayHours(date: Date, settings: OperatingHoursSettings): DayHours {
  const key = getDayKey(date);
  // Filet de sécurité : si les horaires reçus sont incomplets (jour manquant),
  // on retombe sur les horaires par défaut pour éviter une erreur.
  return settings?.[key] ?? DEFAULT_OPERATING_HOURS[key];
}

/** Vérifie si le jour est fermé (dimanche ou marqué closed) */
export function isDayClosed(date: Date, settings: OperatingHoursSettings): boolean {
  const day = getDayHours(date, settings);
  return day?.closed === true || date.getDay() === 0;
}

/** Vérifie si une date est un dimanche */
export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

/** Vérifie si une date est un samedi */
export function isSaturday(date: Date): boolean {
  return date.getDay() === 6;
}
