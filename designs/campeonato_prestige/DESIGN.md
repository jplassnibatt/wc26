# Design System Document: The Prestigious Curator

## 1. Overview & Creative North Star
**Creative North Star: "The Digital Almanac"**
This design system moves away from the "utility-first" look of sports apps to embrace the feel of a high-end, limited-edition editorial publication. It is designed to feel like a VIP invitation to the world’s greatest sporting event. 

By utilizing **intentional asymmetry**, high-contrast typography scales, and **tonal layering**, we avoid the common "grid-of-boxes" trap. We treat the mobile screen as a canvas where information isn't just displayed—it is curated. The tension between the classic authority of *Playfair Display* and the technical precision of *Inter* creates a visual language of "Heritage meets Future."

---

## 2. Colors: The Palette of Prestige
The palette is rooted in the deep `primary` (#004d23) of the pitch and the `secondary` (#775a19) of the trophy.

*   **The "No-Line" Rule:** To maintain a premium, seamless aesthetic, **do not use 1px solid borders to section content.** Boundaries must be defined through background color shifts. For example, a match detail card (`surface_container_lowest`) should sit on a `surface_container_low` section to create a soft, natural edge.
*   **Surface Hierarchy & Nesting:** Treat the UI as stacked sheets of fine stationery. 
    *   Use `surface` for the main background.
    *   Use `surface_container_lowest` for primary content cards (Matches, Standings).
    *   Use `surface_container_high` for global navigation or persistent elements.
*   **The "Glass & Gold" Rule:** For floating elements like "Live Score" overlays or "Top Navigation," use Glassmorphism. Apply a semi-transparent `surface` color with a `backdrop-filter: blur(20px)`. 
*   **Signature Textures:** Main CTAs should not be flat. Use a subtle linear gradient from `primary` (#004d23) to `primary_container` (#1e6637) at a 135-degree angle to provide a velvet-like depth.

---

## 3. Typography: Editorial Authority
The type system is a dialogue between tradition and data.

*   **Display & Headlines (Playfair Display):** Use `display-lg` and `headline-md` for phase names (e.g., "Quarter Finals") and marquee titles. Use "Optical Kerning" and slightly tighter tracking (-2%) for headlines to give them a customized, printed feel.
*   **Data & Body (Inter):** Use `body-md` for all game statistics and match commentary. Inter provides the legibility required for fast-moving tournament data.
*   **The Hierarchy of Prestige:** Always pair a `headline-sm` (Serif) with a `label-sm` (Sans-serif, All Caps, +10% tracking) to create a sophisticated editorial header for sections.

---

## 4. Elevation & Depth: Tonal Layering
In this system, shadows are a last resort, not a default.

*   **The Layering Principle:** Depth is achieved by "stacking" surface tiers. A `surface_container_lowest` card on a `surface_container_low` background creates a "soft lift."
*   **Ambient Shadows:** When an element must float (e.g., a Bottom Sheet or a Floating Action Button), use a shadow with a 24px blur and only 4% opacity, using the `on_surface` color as the shadow base. This mimics natural light on premium paper.
*   **The "Ghost Border" Fallback:** If a container requires more definition, use a "Ghost Border." Apply the `outline_variant` token at **15% opacity**. This provides a hint of structure without breaking the minimalist flow.
*   **Gold Accents:** Use `secondary` (#775a19) for delicate "hairline" separators (0.5pt) only when separating high-level editorial sections, simulating gold-leaf detailing.

---

## 5. Components

### Buttons
*   **Primary:** A gradient of `primary` to `primary_container`. Text in `on_primary`. Corner radius: `sm` (0.125rem) for a sharp, tailored look.
*   **Secondary (Gold):** `secondary_container` background with `on_secondary_container` text. Use for "Premium" or "VIP" features.
*   **Tertiary:** No background. `primary` text in `label-md` (All Caps) with a 1px `secondary` underline.

### Cards & Lists
*   **Match Cards:** Forbid the use of divider lines. Use vertical white space (Scale `6` or `8`) to separate match rows.
*   **Live Indicators:** A `surface_container_lowest` card with a `primary` "Pulse" dot and a `secondary` (Gold) hairline on the left edge to indicate importance.

### Inputs & Search
*   **Fields:** Background `surface_container_low`. No border. On focus, transition the background to `surface_container_lowest` and add a 1px `secondary` (Gold) "Ghost Border" at 20% opacity.

### Scoreboard Component (Custom)
*   The score should be the hero. Use `display-md` for scores. Place them inside a `surface_container_highest` capsule with a `sm` (0.125rem) corner radius. Use `secondary` for the "clock" text to highlight the passage of time as a precious commodity.

---

## 6. Do's and Don'ts

### Do:
*   **Do** use asymmetrical margins. For example, a 2.75rem (`8`) left margin for headers and a 1.4rem (`4`) right margin for content.
*   **Do** use the `secondary` (Gold) color sparingly. It is a "spice," not a main ingredient.
*   **Do** leverage `surface_bright` for highlight states in lists.

### Don't:
*   **Don't** use standard "Material Blue" or generic grey shadows.
*   **Don't** use `full` (9999px) rounded corners for cards; it feels too playful. Stick to `sm` or `none` for a professional, architectural feel.
*   **Don't** use 100% black. Use `on_surface` (#1a1c1c) for all "black" text to keep the palette soft and high-end.
*   **Don't** clutter the screen. If a screen feels busy, increase the spacing scale (e.g., move from `5` to `8`) rather than adding dividers.