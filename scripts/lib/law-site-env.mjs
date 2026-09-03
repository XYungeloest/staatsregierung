/**
 * Muss als erstes Modul importiert werden: Die gemeinsamen Routenhelfer
 * (@ostrecht/shared/config/site.ts) entscheiden beim Laden über SITE_TARGET,
 * ob Verweise auf OstRecht relativ und Verweise auf das Staatsportal absolut
 * gebildet werden. Werkzeuge, die die D1-Projektion von OstRecht schreiben,
 * müssen deshalb als Rechtsportal laufen, sonst landen Portalpfade relativ
 * und Normadressen mit fremdem Origin in der Datenbank.
 */
process.env.SITE_TARGET = 'law';
