#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

interface HookInput {
    session_id: string;
    transcript_path: string;
    cwd: string;
    permission_mode: string;
    prompt: string;
}

interface PromptTriggers {
    keywords?: string[];
    intentPatterns?: string[];
}

interface SkillRule {
    type: 'guardrail' | 'domain';
    enforcement: 'block' | 'suggest' | 'warn';
    priority: 'critical' | 'high' | 'medium' | 'low';
    description?: string;
    skillPath?: string;
    promptTriggers?: PromptTriggers;
    resourceMapping?: Record<string, string>;
}

interface GlobalSettings {
    maxSkillsPerPrompt?: number;
    showResourceHints?: boolean;
    logActivations?: boolean;
}

interface SkillRules {
    version: string;
    skills: Record<string, SkillRule>;
    globalSettings?: GlobalSettings;
}

interface MatchedSkill {
    name: string;
    matchType: 'keyword' | 'intent';
    matchedOn: string;
    config: SkillRule;
    relevantResources: string[];
}

// Word-boundary keyword matching. Prevents substring false positives
// ("build" ⊅ "ui", "rapid" ⊅ "api", "iconic" ⊅ "icon"). Multi-word
// keywords are phrase-matched with flexible whitespace.
function keywordMatches(prompt: string, keyword: string): boolean {
    const escaped = keyword
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\s+/g, '\\s+');
    const re = new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, 'i');
    return re.test(prompt);
}

function findRelevantResources(
    prompt: string,
    resourceMapping?: Record<string, string>
): string[] {
    if (!resourceMapping) return [];

    const resources = new Set<string>();

    for (const [pattern, resourceFile] of Object.entries(resourceMapping)) {
        const keywords = pattern.split('|');
        if (keywords.some(kw => keywordMatches(prompt, kw))) {
            resources.add(resourceFile);
        }
    }

    return Array.from(resources);
}

function resolveProjectDir(): string {
    if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
    // This file lives at <project>/.claude/hooks/ — walk up two levels.
    return join(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

async function main() {
    try {
        // Read input from stdin
        const input = readFileSync(0, 'utf-8');
        const data: HookInput = JSON.parse(input);

        // Load skill rules
        const projectDir = resolveProjectDir();
        const rulesPath = join(projectDir, '.claude', 'skills', 'skill-rules.json');
        const rules: SkillRules = JSON.parse(readFileSync(rulesPath, 'utf-8'));
        const maxSkills = rules.globalSettings?.maxSkillsPerPrompt ?? 3;

        const matchedSkills: MatchedSkill[] = [];

        // Check each skill for matches
        for (const [skillName, config] of Object.entries(rules.skills)) {
            const triggers = config.promptTriggers;
            if (!triggers) {
                continue;
            }

            let matchType: 'keyword' | 'intent' | null = null;
            let matchedOn = '';

            // Keyword matching (word-boundary)
            if (triggers.keywords) {
                const matched = triggers.keywords.find(kw => keywordMatches(data.prompt, kw));
                if (matched) {
                    matchType = 'keyword';
                    matchedOn = matched;
                }
            }

            // Intent pattern matching
            if (!matchType && triggers.intentPatterns) {
                for (const pattern of triggers.intentPatterns) {
                    if (new RegExp(pattern, 'i').test(data.prompt)) {
                        matchType = 'intent';
                        matchedOn = pattern;
                        break;
                    }
                }
            }

            if (matchType) {
                const relevantResources = findRelevantResources(data.prompt, config.resourceMapping);
                matchedSkills.push({
                    name: skillName,
                    matchType,
                    matchedOn,
                    config,
                    relevantResources
                });
            }
        }

        // Sort by priority, cap at maxSkillsPerPrompt
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        matchedSkills.sort((a, b) =>
            priorityOrder[a.config.priority] - priorityOrder[b.config.priority]
        );
        const activatedSkills = matchedSkills.slice(0, maxSkills);

        // Write skill-state.json for block-enforcement skills
        const blockedSkills = activatedSkills.filter(s => s.config.enforcement === 'block');
        if (blockedSkills.length > 0) {
            try {
                const cacheDir = join(projectDir, '.claude', 'tsc-cache', data.session_id);
                const statePath = join(cacheDir, 'skill-state.json');

                // Load existing state to preserve consumed skills
                let existingState: Record<string, unknown> = {};
                try {
                    if (existsSync(statePath)) {
                        const parsed = JSON.parse(readFileSync(statePath, 'utf-8'));
                        if (parsed.session_id === data.session_id) {
                            existingState = parsed.activated || {};
                        }
                    }
                } catch { /* start fresh */ }

                const activated: Record<string, unknown> = { ...existingState };
                for (const skill of blockedSkills) {
                    const skillDir = skill.config.skillPath
                        ? dirname(skill.config.skillPath) + '/'
                        : `.claude/skills/${skill.name}/`;

                    // Don't overwrite if already consumed
                    const existing = activated[skill.name] as { consumed?: boolean } | undefined;
                    if (existing?.consumed) continue;

                    activated[skill.name] = {
                        enforcement: 'block',
                        skillPath: skill.config.skillPath || '',
                        skillDir,
                        activatedAt: new Date().toISOString(),
                        consumed: false,
                    };
                }

                if (!existsSync(cacheDir)) {
                    mkdirSync(cacheDir, { recursive: true });
                }
                writeFileSync(statePath, JSON.stringify({
                    session_id: data.session_id,
                    activated,
                }, null, 2));
            } catch {
                // Silent — don't break skill activation output
            }
        }

        // Compact match box (≤6 lines). No output at all when nothing matched.
        if (activatedSkills.length > 0) {
            let output = '\n━━ SKILLS ACTIVATED — read SKILL.md + resources before coding ━━\n';
            for (const skill of activatedSkills) {
                const skillPath = skill.config.skillPath || `.claude/skills/${skill.name}/SKILL.md`;
                const resources = skill.relevantResources.length > 0
                    ? ` (+ ${skill.relevantResources.map(r => `resources/${r}`).join(', ')})`
                    : '';
                output += `✅ ${skill.name} ← "${skill.matchedOn}" · Read: ${skillPath}${resources}\n`;
            }
            output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
            console.log(output);
        }

        // Check transcript size for compaction warning
        if (data.transcript_path) {
            try {
                const stats = statSync(data.transcript_path);
                const sizeKB = stats.size / 1024;
                if (sizeKB > 500) {
                    let warning = '\n⚠️  CONTEXT SIZE WARNING\n';
                    warning += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                    warning += `Transcript: ${Math.round(sizeKB)}KB — approaching compaction threshold.\n`;
                    warning += 'Run /task-plan-update before context is lost.\n';
                    warning += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
                    console.log(warning);
                }
            } catch {
                // Ignore — transcript may not exist yet
            }
        }

        // Check for active tasks and display reminder
        const activeTasksDir = join(projectDir, 'dev', 'active');
        if (existsSync(activeTasksDir)) {
            try {
                const activeTasks = readdirSync(activeTasksDir)
                    .filter(f => {
                        const fullPath = join(activeTasksDir, f);
                        return statSync(fullPath).isDirectory();
                    });

                if (activeTasks.length > 0) {
                    let taskOutput = '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
                    taskOutput += '📝 ACTIVE TASKS REMINDER\n';
                    taskOutput += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
                    taskOutput += `Active tasks: ${activeTasks.join(', ')}\n\n`;
                    taskOutput += 'Before clearing chat, run: /task-plan-update\n';
                    taskOutput += 'To resume after clear, run: /resume [task-name]\n';
                    taskOutput += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
                    console.log(taskOutput);
                }
            } catch {
                // Silently ignore errors reading active tasks
            }
        }

        process.exit(0);
    } catch (err) {
        console.error('Error in skill-activation-prompt hook:', err);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Uncaught error:', err);
    process.exit(1);
});
