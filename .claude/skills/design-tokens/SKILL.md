---
name: design-tokens
description: Use the TOPA design tokens (colors, Lexend, touch targets) when building or styling any kiosk or dashboard screen. Use when writing Tailwind classes or CSS, choosing colors or fonts, sizing buttons, or reviewing visual fidelity.
---

# Design tokens

The `@theme` block in `topa/web/src/index.css` is the **single source**. Tailwind 4
turns each `--color-x` into `bg-x`, `text-x`, `border-x`, and CSS reads it as
`var(--color-x)`. **Never hardcode a hex**, in CSS or as an arbitrary value
(`bg-[#1A4D49]`), and never use Tailwind's default palette (`bg-blue-500`,
`text-gray-600`): `@theme` resets it (`--color-*: initial`), so such a class
compiles to nothing. A new colour goes into `@theme` first, then gets used. The
allowed copies are where CSS cannot be read: `theme-color` in `topa/web/index.html`
and `system_bars` (the Android bars) in
`topa/web/src-tauri/gen/android/app/src/main/res/values/colors.xml`.
If this table and `index.css` disagree, `index.css` wins and this file gets
fixed.

## Colors

Contrast is measured against cream; AA text needs 4.5:1.

| Token | Hex | Role |
|---|---|---|
| `cream` | #FBF7EC | the ground of every screen |
| `ground-2` | #F3EEE1 | secondary surface: sections, grouped rows |
| `white` | #FFFFFF | cards; text on teal |
| `sage-tint` | #EEF3F0 | highlighted or selected surface (the suggestion, the chosen option) |
| `teal` | #1A4D49 | brand and primary accent: the primary action fill, selection, links (8.9:1) |
| `on-teal` | #DCE6E2 | secondary text on a teal fill (7.5:1 on teal) |
| `slate` | #3D5552 | secondary dark: secondary actions, icons (7.5:1) |
| `ink` | #000000 | primary text (19.6:1) |
| `muted` | #4A5553 | secondary text (7.2:1) |
| `line` | #E4DDCB | hairlines and card borders |
| `sage` | #9DB3AD | decoration only (2.1:1): never text, never the only sign of a state |
| `warning` | #9A5508 | warnings as text or icon: esgotado, fila cheia, servidor local sem resposta (5.3:1) |
| `warning-tint` | #FBF0DE | light warning surface behind `warning` text; the warning dot on teal |

- One primary action per screen, in teal with white text. Everything else is
  slate, outline or plain text.
- There is no red. Errors use `warning` plus an icon and words that say what
  to do; a state is never told by colour alone.
- `line` and `sage` are below 3:1: a control is recognised by its fill or a
  teal/slate border, never by a `line` border alone.

## Typography

One family, **Lexend**, loaded from Google Fonts in `topa/web/index.html` with
weights **400, 500, 600 and 700** only, and set as `--font-sans`, so it is the
default. `font-light` or `font-extrabold` would fall back to a synthesized
face: stay on `font-normal`, `font-medium`, `font-semibold`, `font-bold`.
Prices, totals and order numbers use `tabular-nums`. Offline (edge mode, a
Tauri build with no network) the font link fails and `system-ui` takes over;
self-host the same four weights if a card needs pixel parity there.

## Kiosk sizes per screen

The kiosk has four layouts: the tablet (the base classes), `short:` (640px or
wider but at most 820px tall), `max-sm:` (under 640px, a small tablet) and
`phone:` (under 480px, a phone in portrait). Tailwind emits `phone:` rules
after `max-sm:` ones, so where both match the phone value wins.

Type and radius roles live in `@theme` with their tablet value; the `:root`
block below it in `index.css` resizes them per layout, so `text-title` alone
gives 44, 36, 30 or 26px.

| Class | Tablet | `short:` | `max-sm:` | `phone:` | For |
|---|---|---|---|---|---|
| `text-title` | 44 | 36 | 30 | 26 | screen titles, order totals |
| `text-heading` | 32 | 32 | 24 | 22 | sheet titles, confirmations |
| `text-lead` | 26 | 26 | 20 | 17 | the main instruction in a card |
| `text-body` | 22 | 22 | 18 | 16 | explanations, hints |
| `text-label` | 22 | 22 | 18 | 17 | button and tile labels |
| `text-caption` | 18 | 18 | 18 | 14 | status, countdowns, demo links |
| `rounded-control` | 24 | 24 | 24 | 20 | buttons and tiles |
| `rounded-panel` | 32 | 32 | 32 | 24 | cards and sheets |

- An element whose tablet sizes match a role uses the role class.
- One with its own tablet sizes keeps them as arbitrary values and joins the
  phone scale with `phone:text-<role>`; a one-off (the start headline, the
  order number) may stay arbitrary at every size.
- Kiosk buttons start from `KIOSK_ACTION`, `PRIMARY_ACTION` or
  `SECONDARY_ACTION` in `src/ui/kiosk/parts.tsx` (radius, weight, the 64px
  phone height and label size) and add their own tablet height and type.

## Touch targets

- **Kiosk: every tappable thing is at least 64px high** (`min-h-16`), with at
  least 8px (`gap-2`) between neighbours. Customers tap standing up, sometimes
  in a hurry; a 40px button is a mis-tap.
- Dashboard (`/painel`, used on a laptop or tablet): at least 44px
  (`min-h-11`).
- The hit area is the whole card or row, not just its label.
