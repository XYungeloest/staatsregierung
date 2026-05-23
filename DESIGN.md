# Design principle no. 1
You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight. Focus on:
 
Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.
 
Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.
 
Motion: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.
 
Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.
 
Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character
 
Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!

# Design-System: Freistaat Ostdeutschland

Dieses Dokument beschreibt die visuelle Leitlinie des Portals. Maßgeblich bleibt der tatsächliche CSS-Stand in `src/styles/global.css`; diese Datei erklärt die Absicht dahinter.

## Grundhaltung

Das Portal soll wie eine sachliche Regierungswebsite wirken: ruhig, belastbar, gut lesbar und ohne Demo- oder Kampagnencharakter. Die Gestaltung ordnet Inhalte, Zuständigkeiten und Rechtsinformationen, statt sich selbst in den Vordergrund zu stellen.

Prioritäten:

- klare Orientierung vor visueller Überraschung
- hoher Textkontrast und stabile Layouts
- nüchterne Amtsanmutung mit freundlicher, nicht dekorativer Farbigkeit
- wiedererkennbare Blau-Weiß-Grün-Anmutung
- barrierearme Interaktion mit sichtbaren Fokuszuständen

## Typografie

Das Portal verwendet Jost als lokale Variable Font. Sie wird in `src/styles/global.css` eingebunden und für Fließtext, Navigation und Überschriften genutzt.

Regeln:

- Überschriften knapp, sachlich und gut scannbar halten.
- Keine negativen Laufweiten verwenden.
- Lange Amts- und Ressortbezeichnungen müssen umbrechen dürfen.
- Hero-Größen nur für echte Seitenköpfe einsetzen, nicht in Karten oder Listen.

## Farbpalette

Die aktuelle Palette ist bewusst gedämpft und behördennah:

- Primärblau: `#173b6b`
- Sekundärgrün: `#2f7b3d`
- Siegelrot: `#8f2e2f`
- Goldakzent: `#c39a3b`
- Text: `#20312d`
- Seitenhintergrund: `#edf1f0`
- Oberfläche: `#fffffb`
- Rahmen: `#c6d2cc`

Blau trägt Navigation, Rechtsbereich, primäre Aktionen und Orientierung. Grün setzt ruhige Akzente im allgemeinen Portal. Rot und Gold bleiben sparsam für hoheitliche Akzente, Hinweise und Statusmomente.

## Layout

Die Seiten arbeiten mit breiten Inhaltsbändern und begrenzten Innencontainern. Karten werden für wiederholte Einheiten genutzt, zum Beispiel Mitglieder, Presse, Stellen oder Datensätze. Ganze Seitenabschnitte sollen nicht wie schwebende Karten wirken.

Regeln:

- Informationsdichte darf behördlich-kompakt sein, solange Abstände und Zeilenlängen lesbar bleiben.
- Wiederholte Karten brauchen stabile Bild- und Textflächen, damit Listen nicht springen.
- Rechtsportal und Normseiten priorisieren Lesbarkeit, Gliederung und zitierfähige Struktur.
- Verkündungen, Fundstellen und Normmetadaten werden als Listen, Tabellen und Definitionen
  dargestellt, nicht als dekorative Teaserflächen.
- Mobile Layouts sollen Inhalte stapeln, nicht verstecken.

## Bilder

Bilder unterstützen Orientierung und Wiedererkennung. Porträts, Ressortbilder und Pressebilder sollen nicht als schwere Originaldateien ausgeliefert werden, wenn eine webtaugliche Fassung ausreicht.

Regeln:

- Bilder unter `public/images/` mit absoluten Pfaden ab `/images/...` referenzieren.
- Porträts webtauglich komprimieren und in stabilen Seitenverhältnissen anzeigen.
- Alternativtexte in den JSON-Inhalten fachlich beschreibend pflegen.
- Bildnachweise nicht auslassen, wenn der Content-Typ sie vorsieht.

## Komponenten

Buttons, Links, Listen, Suchmasken und Karten bleiben zurückhaltend. Ecken sind leicht gerundet, Rahmen fein, Schatten schwach. Hover- und Fokuszustände dürfen deutlich sein, sollen aber keine Bewegung oder Effekte erzwingen.

Geeignete Muster:

- Breadcrumbs für tiefe Bereiche
- Tabellen und strukturierte Listen für Rechts- und Verwaltungsinhalte
- Karten für wiederholte Teaser
- Tags nur, wenn sie beim Scannen helfen
- dezente Hinweisboxen für Status, Zuständigkeit oder Kontext

## Was vermieden wird

- Marketing-Heroes ohne Verwaltungsnutzen
- starke Farbverläufe als Hauptmotiv
- dekorative Formen ohne Informationswert
- übertriebene Animationen
- öffentliche Texte mit technischen Architekturbegriffen
- Layouts, die wie eine Entwicklerdemo oder ein Dashboard-Prototyp wirken
