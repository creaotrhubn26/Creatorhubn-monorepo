# Premiere plugin UX/UI direction

## Goal and surface

Make CreatorHub Video Room feel like an editorial control panel inside Premiere,
not a web dashboard compressed into a plugin window. The primary audience is an
editor who needs to review a specific cut, synchronize work, and publish the next
version without losing sequence or version context.

Supported layouts are the manifest minimum of 300 × 420, the preferred 400 ×
720 docked panel, and wider floating panels up to 2000 × 2000.

## Evidence

- **Provided:** The existing Premiere screenshots show a long scrolling surface,
  competing actions, distant status feedback, and raw activity errors.
- **Observed:** Review already has five internal tools, while sequence sync,
  publishing, status, and activity are separate cards below it. Project/version
  selectors become unreachable as the user scrolls through those cards.
- **Observed:** The plugin already has a compact dark token set and CreatorHub
  orange accent. No shared component library or separate design-token package is
  used by this dependency-free UXP surface.
- **Inferred:** Editors need current project, cut, and sync state before every
  destructive or version-creating action. This is treated as a workflow
  requirement, not a brand claim.

## Direction

Use an **editorial command panel** with one stable context and four work areas:

1. **Review** — comments, tasks, approvals, transcript/QC, and live review.
2. **Sync** — active Premiere sequence and native two-way synchronization.
3. **Send** — export configuration, review workflow, progress, and recovery.
4. **Activity** — diagnostic history separated from user-facing status.

CreatorHub orange indicates the selected location or the single primary action.
Green, amber, and red are reserved for semantic state. Surfaces stay close to
Premiere's dark, low-elevation environment.

## Keep, change, and avoid

- **Keep:** real Norwegian content, existing Adobe/CreatorHub dark palette,
  native controls, secure login, exact version binding, and every current DOM ID.
- **Change:** top-level hierarchy, action priority, context visibility, spacing,
  focus treatment, empty states, and narrow/wide adaptation.
- **Avoid:** decorative gradients, glass effects, oversized marketing headers,
  icon-only actions, and hiding raw diagnostics behind the main workflow.

## Token and layout contract

- Existing raw colors become semantic canvas, surface, inset, divider, text,
  accent, success, warning, and danger roles in `styles.css`.
- Spacing follows a 4/8/12/16 rhythm; cards use one 8 px radius and one border.
- At 300–519 px, context fields and multi-column forms stack.
- At 520 px and wider, project/version context and compatible form fields share
  columns. Content remains bounded for readable line lengths in very wide panels.
- Top-level work-area tabs are the first signed-in control, and switching work
  areas returns the panel to the top. This avoids Premiere 26.5 UXP's broken
  `position: sticky` layout behavior.

## Components and states

- Work-area tabs expose `tablist`, `tab`, `tabpanel`, `aria-selected`, keyboard
  left/right navigation, and a visible focus ring.
- Disabled sync/publish actions have an adjacent plain-language readiness reason.
- Publishing changes its primary action to resume when a saved upload checkpoint
  exists; a new send no longer competes visually with recovery.
- User-facing status remains near the work-area navigation. Timestamped technical
  activity lives only in Activity.
- Empty, loading, success, warning, failure, hover, active, selected, disabled,
  and focus-visible states use the same semantic roles.

## Acceptance signals

- Review, Sync, Send, and Activity never render as one continuous card stack.
- Project and exact version remain above the work-area content.
- Only one orange primary action is visible in Sync or Send under normal state.
- The 300 × 420 surface remains fully reachable and form grids stack correctly.
- Existing static DOM contract and all plugin unit tests pass.
- The installed panel loads in Premiere 25.6+ and the four work areas can be
  traversed without UXP Developer Tool.
