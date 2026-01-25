# Skill Enforcement Rule

## MANDATORY REQUIREMENT

When the skill activation hook fires and suggests reading skills:

1. **You MUST use the Read tool** to read the suggested SKILL.md file
2. **You MUST use the Read tool** to read the suggested resource files
3. **You MUST NOT write any code** until you have read these files
4. **You MUST apply the patterns** from the skill resources

## Why This Matters

- Skills contain project-specific patterns and conventions
- Ignoring skills leads to inconsistent code
- Resources map directly to the task at hand
- Following patterns reduces bugs and review cycles

## Verification

Before writing code, confirm:
- [ ] Read SKILL.md for the activated skill
- [ ] Read all suggested resource files
- [ ] Understand the patterns to apply
- [ ] Know which existing code to follow

## Activation Triggers

Skills are activated when:
- Keywords in prompt match skill triggers (e.g., "api", "route", "component")
- Intent patterns match (e.g., "create a", "implement", "add")
- The hook output explicitly suggests reading skills

## Violation

If you write code without reading activated skills, you are violating this rule.
Stop and read the skills before proceeding.

## Enforcement Level

**MANDATORY** - No exceptions. Always read skills when activated.
