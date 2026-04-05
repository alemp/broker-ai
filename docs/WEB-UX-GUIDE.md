# Web app — UX & UI guide

This document defines how the **ai-copilot** web interface should behave and look. It complements product specs (`PRODUCT.md`) and is the reference for future UI work.

## Audience and goals

Primary users are **brokerage staff** (commercial CRM: clients, leads, opportunities, insurers, campaigns). Goals:

- **Scan and act fast** — overdue actions, today’s interactions, pipeline filters.
- **Trust the system** — clear loading, errors, and API health without jargon.
- **Work on mobile** — core navigation and lists must be usable on small screens.

## Design principles

1. **Progressive disclosure** — show summaries first; details on drill-down pages.
2. **Consistent rhythm** — same page chrome (title, subtitle, spacing) on every list/workspace view.
3. **Accessible by default** — keyboard, focus, labels, one `<main>` per authenticated view, skip link.
4. **Boring technology for layout** — Tailwind v4 + shadcn/ui tokens; avoid one-off magic numbers.
5. **Language** — UI copy in Portuguese (`pt`); code and routes in English.

## Layout

| Element | Rule |
|--------|------|
| Content width | Prefer `max-w-6xl` for data-heavy pages (pipeline, dashboards). Use `max-w-5xl` only if the layout is narrow by design. |
| Horizontal padding | `px-4` on page body; align with header. |
| Vertical spacing | `space-y-8` between major sections; `gap-4` / `gap-6` inside cards. |
| Header | Sticky top bar is optional; current pattern is static border-bottom header. |

Authenticated shell (`AppLayout`):

- Brand / home link on the left.
- Primary navigation with **visible active state** (current route).
- User email + logout on the right; on small viewports, nav moves into a **menu** toggled from the header.
- **Skip to content** link (visible on focus) targets `#main-content`.

## Components

| Component | Use for |
|-----------|---------|
| `PageHeader` | Page `h1`, optional description, optional actions (toolbar). |
| `Card` (+ header/content) | Grouping forms, filters, and lists. |
| `Button` | Primary actions; use `outline` / `secondary` for secondary. |
| `Skeleton` | List and panel loading instead of only the word “Loading…”. |
| Form controls | Prefer shadcn `Input` / `Label`; native `<select>` styled with `border-input` until a Select primitive is added. |

## Navigation patterns

- **Active route**: `NavLink` with distinct styles for `isActive` (foreground + subtle background).
- **Mobile**: After choosing a link, close the menu (`useLocation` resets open state).
- **Deep links**: List rows link to detail; preserve mental model “list → detail → back”.

## Feedback states

| State | Pattern |
|-------|---------|
| Loading | `Skeleton` blocks or `aria-busy` where appropriate; short labels (“Carregando…”) where skeletons are not worth it. |
| Empty | Muted text explaining what is empty and, if useful, a single CTA (e.g. create client). |
| Error | `text-destructive`, one line + retry if applicable; form errors next to fields. |
| Success / system health | Non-blocking; use a **status indicator** (dot + label) for API health on the dashboard. |

## Accessibility checklist

- Every interactive control has a visible **focus** style (inherited from shadcn `Button` / inputs).
- Icon-only buttons need `aria-label` (e.g. open/close menu).
- Skip link is the first focusable element in the shell.
- Do not nest `<main>`; login/register pages keep their own `<main>` outside `AppLayout`.

## Theming

- Colors come from `index.css` (`:root` / `.dark`). Prefer semantic tokens: `background`, `foreground`, `muted-foreground`, `primary`, `destructive`.
- **Positive operational state** (API OK) may use a distinct green dot for quick recognition; document if we later add `--success` token.

## Implementation backlog (suggested)

- **Select:** `FormSelect` (Radix) is used across list/detail flows, including **Client detail** (CRM core, profile, insured, interactions, portfolio). Prefer it for any new dropdowns.
- **Table** view for long client/opportunity lists (sort, column resize later).
- **Toasts:** Sonner is wired in `main.tsx`; success toasts on key creates/saves (extend as new mutations ship).
- Optional **dark mode** toggle wired to `.dark` on `<html>`.

## Related files

- `apps/web/src/components/AppLayout.tsx` — shell, nav, skip link, `#main-content`.
- `apps/web/src/components/PageHeader.tsx` — page title band.
- `apps/web/src/components/ui/skeleton.tsx` — loading placeholders.
- `apps/web/src/components/ui/select.tsx` — `FormSelect`, `SELECT_EMPTY_VALUE`.
- `apps/web/src/index.css` — design tokens.
