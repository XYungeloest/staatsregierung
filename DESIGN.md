# Design System: Sachsen.de & Freistaat Ostdeutschland

Dieses Dokument beschreibt das visuelle Design-System, das auf der offiziellen Website des "Freistaat Ostdeutschland".

## 1. Markenidentität & Tonalität
Das Design vermittelt Seriosität, Vertrauen und offizielle Autorität. Es ist klar strukturiert, funktional und barrierefrei ausgerichtet. Durch die Ergänzung von Blau-Tönen wird die formelle, staatliche Anmutung verstärkt.

## 2. Farbpalette

### Primärfarben
*   **Sachsen-Grün:** `#3E8132` (Wird für das Logo, Navigationselemente und Akzente verwendet)
*   **Ostdeutschland-Blau:** `#1A3B66` (Ein tiefes, seriöses Blau für Header-Elemente, Buttons und Kontraste)
*   **Weiß:** `#FFFFFF` (Hintergrundfarbe für Klarheit und Lesbarkeit)

### Sekundär- & Graustufen
*   **Dunkelgrau:** `#333333` (Haupttextfarbe für hohen Kontrast)
*   **Hellgrau:** `#F3F3F4` (Hintergrund für Sektionen und Trennelemente)
*   **Mittleres Grau:** `#DADADA` (Rahmen und sekundäre Informationen)

## 3. Typografie
*   **Schriftart:** Public Sans (oder eine ähnliche serifenlose Systemschrift wie Arial/Helvetica für maximale Kompatibilität).
*   **Hierarchie:**
    *   **H1 (Überschriften):** Fett, dunkelgrau, großzügiger Zeilenabstand.
    *   **Body Text:** Gut lesbare Größe (ca. 16px), hoher Kontrast zum Hintergrund.
    *   **Links:** Oft in Sachsen-Grün oder Ostdeutschland-Blau.

## 4. Komponenten & Stil-Elemente

### Navigation
*   Horizontale Hauptnavigation mit klaren Kategorien.
*   Suche prominent im Header platziert, oft in einem farblich abgesetzten Bereich (Blau).
*   Breadcrumbs zur einfachen Orientierung.

### Buttons & Interaktion
*   **Primär-Buttons:** Abgerundete Ecken, Hintergrund in Sachsen-Grün oder Ostdeutschland-Blau, weißer Text.
*   **Sekundär-Buttons:** Graue Konturen oder dezente Hintergründe.
*   **Hover-Effekte:** Dezente Farbänderung oder Unterstreichung zur Anzeige der Interaktivität.

### Karten (Cards) & Sektionen
*   Flaches Design mit feinen grauen Rahmen.
*   Sektionen können durch einen dezenten hellgrauen Hintergrund oder farbige Akzentlinien oben getrennt werden.

## 5. Layout-Prinzipien
*   **Grid:** Strukturiertes Spalten-Layout (meist 12-Spalten-Raster).
*   **Whitespace:** Großzügige Verwendung von Leerraum zur Trennung von Informationsbereichen.
*   **Responsive Design:** Optimiert für Desktop, Tablet und Mobile.

## 6. Barrierefreiheit
*   Hoher Kontrast zwischen Text und Hintergrund.
*   Klare visuelle Fokus-Indikatoren für Tastaturnavigation.
*   Strukturierte Verwendung von HTML-Headings (H1-H6).

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