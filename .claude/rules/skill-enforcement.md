# Skill Enforcement Rule

<rules>
- ALWAYS read SKILL.md using the Read tool when the skill activation hook fires (skills contain project-specific patterns that prevent inconsistent code)
- ALWAYS read ALL suggested resource files before writing any code (resources map directly to the task — skipping them leads to pattern violations)
- NEVER write code until you have read and understood the activated skill patterns (ignoring skills causes bugs and review cycles)
- ALWAYS apply the patterns from skill resources in your implementation (pattern compliance is the whole point of the skill system)
</rules>

Skills activate when keywords match (e.g., "api", "route", "component"), intent patterns match (e.g., "create a", "implement"), or the hook output explicitly suggests reading skills.

**Enforcement:** MANDATORY — no exceptions.
