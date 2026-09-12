---
moduleId: resources
sidebarSection: Resources
sidebarPaths:
  - /backend/resources/resources
  - /backend/resources/resource-types
relatedModules:
  - planner
  - customers
  - procurement
  - insurance_desk
  - cases
existingUserGuideEn:
  - apps/docs/docs/user-guide/resources-and-resource-types.mdx
plManualStatus: not_started
---

# Resources

## Purpose and audience

**Resource planning**: typed assets with capacity, scheduling, optional vehicle/fleet fields, service book, and CRM links. For fleet/resource coordinators managing assets and availability.

Requires **planner** module.

## Sidebar navigation

| Menu label (i18n key) | Path | Required feature |
|-----------------------|------|------------------|
| Resources | `/backend/resources/resources` | `resources.view` |
| Resource types | `/backend/resources/resource-types` | `resources.manage_resources` |

## Key screens

### Resource types
- List, create, edit — name, appearance, vehicle financing eligibility.

### Resources list
- **Path:** `/backend/resources/resources`
- DataTable of all resources.

### Resource detail
- **Path:** `/backend/resources/resources/[id]`
- Type, capacity, customer link, **availability rules** (planner), service book, vehicle gallery/accessories, notes, activities, version history, send message, linked policies (insurance).

## Main workflows

### 1. Define a resource type
1. **Daily work → Resources → Resource types** → Create.
2. Set name and options.
3. Save.

### 2. Create a resource
1. **Resources** list → Create.
2. Select type; optional link to CRM person/company.
3. Configure availability in planner editor.

### 3. Schedule and availability
1. Open resource detail → availability rules.
2. Planner builds schedule items for booking views.

### 4. Vehicle-specific maintenance
- Service book, accessories (linked accessory resources).

## Roles and permissions

| Feature ID | What it allows | Default roles |
|------------|----------------|---------------|
| `resources.view` | View resources | admin only |
| `resources.manage_resources` | Types and resource CRUD | admin only |

No employee defaults — assign features via roles as needed.

## Relations to other modules

- **planner** (required) — availability rules and schedules.
- **customers** — optional `customerEntityId` on resource.
- **procurement** — process resource links.
- **insurance_desk** — linked policies on resource detail.
- **cases** — optional case resource link.

## Common pitfalls and FAQ

- **Q:** Employee cannot see resources? **A:** No default employee ACL; grant `resources.view`.
- **Q:** Availability not showing? **A:** Requires planner module and rules configured.

## Authoring todos

- [ ] Align PL manual with EN `resources-and-resource-types.mdx`.
- [ ] Document vehicle vs generic resource types for deployment.
