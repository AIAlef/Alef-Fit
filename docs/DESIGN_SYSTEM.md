# Design System

> **Status: planned.** This document is filled in during the **Design phase** (Roadmap Step 1). It captures the single visual language so all five tabs feel like one app while keeping every feature.

## Why a design phase

The reference screens come from several different apps, so they don't share a look. The goal of this phase is to unify them into **one cohesive theme** — without dropping any feature — and to lock that theme into reusable Flutter components, so every later milestone is consistent and faster to build.

## What it defines (tokens)

- **Color** — light + dark palettes; the per-body-part accents (Abs green … Triceps teal); semantic roles (surface, on-surface, outline, success/warning).
- **Typography** — a type scale that respects the **text-size setting** (system or manual slider); two weights only.
- **Spacing, radius, elevation** — consistent rhythm for cards, rows, sheets.
- **Iconography** — one icon set; the 5 tab icons.
- **Imagery** — how card background images are treated so text stays legible (overlay/scrim rules) — this is the backbone of the "section card backgrounds" feature.

## Components (reused everywhere)

Section card · list row (exercise / program / history) · detail scaffold (image-video carousel + steps) · **logging overlay** (weight/reps grid + inline history) · **timer / stopwatch** · settings row / slider / switch · folder & tag chips · empty states · dialogs & bottom sheets.

## Deliverables of the phase

1. High-fidelity **mockups** of the key screens for your sign-off:
   Exercise list + detail · Program logging overlay + timer · Discipline home + a folders/tags screen · Retro · Settings home + a settings detail · the card-background treatment.
2. This doc, filled in with the final tokens.
3. `AppTheme` tokens + a component library in `app/lib/core/widgets/`.
4. The settings store (`app_settings`) + theme/text-size wiring, so features can read appearance settings immediately.

## How we work it (the design ↔ build loop)

For this phase and every milestone after: **Claude proposes the screen design (rendered mockups) → you approve or adjust → Claude implements it to match → we verify.** Design never runs ahead of an approved direction, and code never runs ahead of an approved design.
