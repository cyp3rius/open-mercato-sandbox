---
moduleId: playbooks
sidebarSection: Service
sidebarPaths:
  - /backend/playbooks
relatedModules:
  - cases
  - dictionaries
existingUserGuideEn: []
plManualStatus: not_started
---

# Playbooks

## Purpose and audience

Versioned **procedural playbooks** for CRM and cases: markdown body, executable procedure steps, audience targeting, SLA defaults, and bindings to cases or resource types. For procedure authors and team leads; operators execute procedures on **cases** (see cases module guide).

Requires **cases** module.

## Sidebar navigation

| Menu label (i18n key) | Path | Required feature |
|-----------------------|------|------------------|
| Playbooks | `/backend/playbooks` | `playbooks.view` |
| Module settings | `/backend/config/playbooks` | `playbooks.settings.manage` |

## Key screens

### List
- **Path:** `/backend/playbooks`
- Columns: slug, title, audience, version, active; import/export markdown batch; filters.

### Create / detail
- **Paths:** `/backend/playbooks/create`, `/backend/playbooks/[id]`
- Procedure steps editor, markdown body, audience (`internal` / `customer_facing` / `both`), tags, recommended owners, SLA.
- Publish version, export markdown.

### Settings
- **Path:** `/backend/config/playbooks`
- Procedure **actions** dictionary.

## Main workflows

### 1. Author a playbook
1. **Daily work → Service → Playbooks** → Create.
2. Write operator-facing body and **Procedure** YAML steps.
3. Save → **Publish version** when ready.

### 2. Import/export markdown
1. List or detail → Import/Export for single or batch round-trip.
2. Git-tracked procedures: use `procedure-authoring` skill (`apps/mercato/content/procedures/`).

### 3. Bind to cases
- `PlaybookBinding` links playbooks to `caseId` or `resourceTypeSlug`.
- Cases match playbooks by context tags.

### 4. Execute on a case
- Operators run procedures from **case detail** (not from playbook list).

## Roles and permissions

| Feature ID | What it allows | Default roles |
|------------|----------------|---------------|
| `playbooks.view` | View list/detail | admin, employee |
| `playbooks.create` | Create | admin only |
| `playbooks.edit` | Edit | admin only |
| `playbooks.delete` | Delete | admin only |
| `playbooks.settings.manage` | Settings/dictionaries | admin only |
| `playbooks.playbook.*.notify` | Created/published notifications | employee gets published notify |

## Relations to other modules

- **cases** (required) — procedure execution, bindings.
- **dictionaries** — procedure status/action dictionaries (seeded).
- **MCP/AI** — import/export via ai-tools.

## Common pitfalls and FAQ

- **Q:** Playbook vs user guide? **A:** Playbooks are in-CRM executable procedures; admin screen docs are separate (`user-guide-authoring`).
- **Q:** Employee cannot edit? **A:** Create/edit/delete are admin-only by default.

## Authoring todos

- [ ] Cross-link to `procedure-authoring` skill in PL manual intro.
- [ ] Document context tag matching rules for case auto-suggest.
