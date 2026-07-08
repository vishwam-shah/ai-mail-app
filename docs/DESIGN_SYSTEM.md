# Design System

## Foundation

- **Tailwind CSS v4**, config-free (CSS-first `@theme`) in `app/globals.css`.
- **shadcn/ui**, `base-nova` style — primitives in `components/ui/` are generated code, built
  on `@base-ui/react` (not Radix). The one exception is the sidebar's collapse animation,
  which uses `@radix-ui/react-collapsible` directly (`components/ui/collapsible.tsx`) because
  Base UI didn't have an equivalent at the time this was built.
- **Icons: Remix Icon (`@remixicon/react`) only**, for every app-authored component. Don't
  reach for `lucide-react` in new code — it's present solely because shadcn's CLI vendors
  `lucide-react` imports into generated primitives (e.g. `components/ui/select.tsx`), and
  those are left as generated rather than hand-edited. Import pattern: `Ri<Name><Style>`, e.g.
  `RiInboxLine`, `RiSendPlaneLine`, `RiAddLine`.

## Color tokens

All color is OKLCH custom properties on `:root`/`.dark`, re-exposed as Tailwind theme colors
via `@theme inline` (so `bg-primary`, `text-muted-foreground`, etc. work normally). The
notable choice: surface tokens (`--card`, `--popover`, `--sidebar`, `--secondary`, `--muted`,
`--accent`, `--border`, `--input`) all carry an **alpha channel baked into the token itself**
(e.g. `--card: oklch(1 0 0 / 55%)`), not applied via a separate opacity utility — that's what
makes `bg-card`/`bg-popover`/`bg-sidebar` translucent everywhere automatically, no
per-component opacity classes needed.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--primary` | near-black | near-white | Active nav pill, primary buttons, send action |
| `--card` | white 55% | dark 45% | List rows, assistant cards, panels |
| `--popover` | white 58% | dark 58% | Dropdowns, dialogs, sheets, select content |
| `--sidebar` | white 45% | dark 45% | Left nav + right assistant panel background |
| `--destructive` | red | lighter red | Errors, cancel/destructive actions |

## Glassmorphism

Defined once in `app/globals.css` under `@layer base`, applied automatically to anything using
the surface tokens above — you don't opt in per-component.

- **Cards** (`.bg-card`, `[data-slot="card"]`): `backdrop-filter: blur(20px) saturate(160%)`
  plus a soft ambient + contact shadow and a 1px inset top highlight, to read as a raised
  frosted panel rather than flat translucency.
- **Floating surfaces** (popover/dialog/sheet/dropdown/select/command): stronger
  `blur(28px) saturate(200%)`, a diagonal light-catching gradient overlay, and a crisper inset
  edge highlight + outer shadow — meant to feel like actual glass rather than just a blurred
  rectangle, since these sit on top of busier content and need more visual separation.
- Body background is three soft radial gradients (blue/pink/teal in light, dimmer variants in
  dark) fixed behind everything, which is what the blur is actually revealing — glass over a
  flat color reads as gray, not glass.

Do not apply `backdrop-filter`/gradient overlays ad hoc on a one-off component — if something
needs the glass look, it should be composed from `bg-card`/`bg-popover`/`data-slot` selectors
so it keeps getting these rules for free and stays consistent if the recipe changes later.

## Radius scale

One `--radius: 1rem` base, with `--radius-sm/md/lg/xl/2xl/3xl/4xl` derived as multiples of it
(`@theme inline`). Interactive pill-shaped elements (nav items, filter inputs, pagination
numbers, badges, buttons in assistant cards) use `rounded-full` directly rather than the
largest radius token, so they stay a true pill at any height instead of a large-but-technically-
rectangular corner radius.

## Component patterns

### Navigation pills (`NavLink.tsx`)

Every sidebar nav item (Compose, Inbox, Sent) renders through the same `NavLink` — one
active/inactive rule, so they cannot visually drift from each other:

```tsx
"rounded-full ... " +
(isActive
  ? "bg-primary text-primary-foreground shadow-sm"
  : "bg-transparent text-muted-foreground hover:bg-white/40 ...")
```

`rounded-full` and the `h-9` height apply unconditionally at every state — only the fill
(solid `bg-primary` vs fully transparent) changes between active and inactive. There is no
resting/idle background tint on inactive items and no shape change; this was a deliberate,
explicit product decision (a rectangular or differently-shaped active state was tried and
rejected) — don't reintroduce either.

### Assistant chat cards (`components/assistant/AssistantCard.tsx`)

`ConfirmSendCard`, `ContactPickerCard`, and `EmailPreviewCard` (the cards the assistant renders
inline in chat) share one shell:

- `AssistantCard` — the `rounded-xl border ... bg-card/70 shadow-md` wrapper, with an
  `eyebrow` label in two styles: `eyebrowBordered` (border-bottom header, for list-style
  cards) or plain (`padded`, for single-content cards like the send confirmation).
- `AssistantCardList` / `AssistantCardRow` — the divided list of clickable rows (avatar +
  text) shared between the contact picker and email preview cards.

When adding a new inline assistant card, compose it from these instead of re-declaring the
shell classes — that duplication (identical `rounded-xl border ... bg-card/70` on three
separate components) is exactly what this pair was extracted to eliminate.

### Skeletons over spinners

Loading states for lists (`EmailList`) use `components/ui/skeleton.tsx` shapes matching the
eventual content (avatar circle + two text lines) rather than a centered spinner, so the
layout doesn't jump when data arrives.

## Feedback (toasts)

Sonner (`components/ui/sonner.tsx`), themed via CSS custom properties rather than default
colors: light green for success, light red for error (`--success-bg/text/border`,
`--error-bg/text/border`), tuned to sit inside the same glass palette instead of Sonner's
default saturated red/green.

## Dark mode

Handled by `next-themes` (`components/theme-provider.tsx`) with a `.dark` class toggling the
entire token set above. Every color, shadow, and glass gradient has an explicit `.dark`
override in `globals.css` — there's no auto-derivation, so any new token added to `:root`
needs a matching `.dark` entry.
