# Agent Skills

Skills extend AI agents with task-specific capabilities. Each skill is a folder containing a `SKILL.md` file plus optional bundled resources.

---

## Structure

```
.ai/skills/
├── README.md
├── backend-ui-design/          # Admin UI patterns
├── check-and-commit/           # CI verify + commit
├── code-review/
├── create-agents-md/
├── crm-*/                      # MCP domain skills (8)
├── dev-container-maintenance/
├── fix-specs/
├── implement-spec/
├── integration-builder/
├── integration-tests/
├── pre-implement-spec/
├── procedure-authoring/        # In-CRM playbook MD
├── remote-crm-mcp/
├── skill-creator/
├── spec-writing/
└── user-guide-authoring/       # Module guides + PL PDF manuals
```

### Skill Folder Layout

```
skill-name/
├── SKILL.md          # Required: instructions + YAML frontmatter
├── scripts/          # Optional: executable code (Python/Bash)
├── references/       # Optional: documentation loaded on demand
└── assets/           # Optional: templates, images, resources
```

---

## SKILL.md Format

Every skill requires a `SKILL.md` with YAML frontmatter (`name` + `description`) and markdown instructions:

```markdown
---
name: skill-name
description: What this skill does and when to use it. Include trigger words and domain terms.
---

Instructions for the agent to follow when this skill is active.

## Section 1
...
```

Only include `name` and `description` in the frontmatter — no other fields.

---

## Installation

### Using the Install Script

Run the script to set up both Claude and Codex skills folders at once:

```bash
yarn install-skills
```

You should see emoji info messages like:

```
ℹ️  Linking .codex/skills → ../.ai/skills
✅  Linked .codex/skills
ℹ️  Linking .claude/skills → ../.ai/skills
✅  Linked .claude/skills
🎉  Skills installation complete.
```

### Claude Code

Symlink the skills folder:

```bash
mkdir -p .claude
ln -s ../.ai/skills .claude/skills
```

Or configure in `.claude/settings.json`:

```json
{
  "skills": {
    "directory": ".ai/skills"
  }
}
```

### Codex

Symlink the skills folder:

```bash
mkdir -p .codex
ln -s ../.ai/skills .codex/skills
```

### Verify

```bash
# Claude Code
claude
> /skills
# Should list backend-ui-design, create-agents-md, integration-tests

# Codex
codex
> /skills
# Should list backend-ui-design, create-agents-md, integration-tests
```

---

## Using Skills

| Agent | Invoke | List |
|-------|--------|------|
| Claude Code | `/skill-name` | `/skills` |
| Codex | `$skill-name` | `/skills` |

Skills also trigger automatically when a task matches the skill's `description`.

---

## Available Skills

### Engineering workflow

| Skill | When to use |
|-------|-------------|
| `backend-ui-design` | Building admin pages, CRUD interfaces, data tables, forms, or detail pages with @open-mercato/ui |
| `check-and-commit` | Running CI-style verification, fixing i18n drift, and only then committing and pushing the current branch |
| `code-review` | Reviewing PRs, code changes, or auditing code quality against project conventions |
| `create-agents-md` | Creating or rewriting AGENTS.md files for packages and modules |
| `fix-specs` | Normalizing legacy spec filenames to `{YYYY-MM-DD}-{slug}.md`, resolving post-normalization collisions, and updating references/links |
| `implement-spec` | Implementing a spec (or specific phases) using coordinated subagents with unit tests, integration tests, docs, progress tracking, and code-review compliance gates |
| `integration-tests` | Running existing integration tests and generating new QA tests (Playwright TypeScript, with optional markdown scenarios) from specs or feature descriptions |
| `pre-implement-spec` | Analyzing a spec before implementation: backward compatibility audit, risk assessment, gap analysis, and readiness report |
| `integration-builder` | Scaffolding integration provider packages (adapters, webhooks, health checks) |
| `dev-container-maintenance` | Auditing and fixing `.devcontainer/` setup and documentation |
| `skill-creator` | Creating a new skill or updating an existing skill |
| `spec-writing` | Drafting or reviewing technical architecture specifications |

### Documentation (operator-facing)

| Skill | When to use |
|-------|-------------|
| `user-guide-authoring` | Module operational descriptions, Polish user manuals (MDX), PDF export for Daily work sidebar modules |
| `procedure-authoring` | Workshop notes → Git MD → playbook import; in-CRM operator procedures |

### MCP / remote CRM (agent-operated)

| Skill | When to use |
|-------|-------------|
| `remote-crm-mcp` | HTTP MCP setup, local→remote promotion gate, Code Mode search/execute |
| `crm-customers` | MCP: people, companies, deals, activities |
| `crm-catalog-sales` | MCP: catalog, sales, currencies, checkout |
| `crm-cases-playbooks` | MCP: cases and playbook import/export |
| `crm-operations` | MCP: resources, procurement, accounting, attachments |
| `crm-directory-auth` | MCP: orgs, users, roles, API keys, staff |
| `crm-config-platform` | MCP: configs, dictionaries, custom entities, feature toggles |
| `crm-inbox-integrations` | MCP: inbox, messages, webhooks, data_sync, workflows |
| `crm-insurance-partners` | MCP: insurance desk, partner programs, lead intake |

### Documentation skills — when to use which

| Goal | Skill | Output location |
|------|-------|-----------------|
| Technical feature design | `spec-writing` | `.ai/specs/` |
| Coding-agent module rules | `create-agents-md` | `AGENTS.md` |
| Module behavior for guides | `user-guide-authoring` | `.ai/module-guides/` |
| Polish operator PDF manual | `user-guide-authoring` | `apps/docs/docs/user-guide/pl/` → PDF |
| In-CRM executable procedure | `procedure-authoring` | `apps/mercato/content/procedures/` |

---

## Creating a New Skill

1. Use the `skill-creator` skill interactively, or create manually:

```bash
mkdir -p .ai/skills/my-skill
```

2. Create `SKILL.md` with frontmatter and instructions
3. Add optional `scripts/`, `references/`, `assets/` as needed
4. Test the skill by invoking it

### Writing Effective Descriptions

The `description` field drives automatic skill selection. Include:

- **Trigger words**: "when building", "when creating", "when designing"
- **Domain terms**: "admin pages", "API endpoints", "CRUD interfaces"
- **Outcomes**: "ensures consistency", "follows conventions"

### Skill Size Guidelines

| Size | Lines | When to split |
|------|-------|---------------|
| Small | < 100 | Single-purpose conventions |
| Medium | 100-300 | Component libraries, API patterns |
| Large | 300-500 | Complex workflows — use `references/` to keep SKILL.md lean |

If exceeding 500 lines, split detailed content into `references/` files.

---

## Skills vs Global Instructions

| File | Scope | When active |
|------|-------|-------------|
| `CLAUDE.md` / `codex.md` | Global project instructions | Always |
| `AGENTS.md` | Agent conventions | Always |
| Skills | Task-specific guidance | On demand |

Use skills when instructions are task-specific, substantial (>50 lines), or benefit from explicit invocation control.

---

## Troubleshooting

**Skill not found**: Verify symlink exists (`ls -la .claude/skills` or `ls -la .codex/skills`) and `SKILL.md` has valid YAML frontmatter.

**Skill not auto-selected**: Improve `description` with more specific trigger words and domain terminology.

**Symlink issues**:
```bash
# Recreate symlinks
rm -f .claude/skills .codex/skills
mkdir -p .claude .codex
ln -s ../.ai/skills .claude/skills
ln -s .ai/skills .codex/skills
```
