# Module guide template

Copy this structure when creating `.ai/module-guides/<module>.md`. Write in **English**. This file is for agents and implementers, not end users.

```markdown
---
moduleId: <module_id>
sidebarSection: <Daily work section, e.g. Service>
sidebarPaths:
  - /backend/<path>
relatedModules:
  - <module_id>
existingUserGuideEn:
  - apps/docs/docs/user-guide/<path>.mdx
plManualStatus: draft | published | not_started
---

# <Module display name>

## Purpose and audience

Who uses this module and what business problem it solves (1–3 sentences).

## Sidebar navigation

| Menu label (i18n key) | Path | Required feature |
|-----------------------|------|------------------|
| … | … | … |

## Key screens

### List
- Path, what the operator sees, main filters/actions.

### Create
- Path, required fields, validation notes.

### Detail
- Path, tabs/sections, primary actions.

## Main workflows

### 1. <Workflow name>
1. Step …
2. Step …

### 2. <Workflow name>
1. Step …

## Roles and permissions

| Feature ID | What it allows | Default roles |
|------------|----------------|---------------|
| … | … | admin, employee, … |

## Relations to other modules

- **module_name** — how they connect (FK, events, widgets).

## Common pitfalls and FAQ

- **Q:** … **A:** …

## Authoring todos

- [ ] Items that need business confirmation or screenshots before PL manual.
```
