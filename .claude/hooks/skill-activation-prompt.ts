#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

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

interface SkillRules {
    version: string;
    skills: Record<string, SkillRule>;
}

interface MatchedSkill {
    name: string;
    matchType: 'keyword' | 'intent';
    matchedOn: string;
    config: SkillRule;
    relevantResources: string[];
}

function findRelevantResources(
    prompt: string,
    resourceMapping?: Record<string, string>
): string[] {
    if (!resourceMapping) return [];

    const resources = new Set<string>();
    const promptLower = prompt.toLowerCase();

    for (const [pattern, resourceFile] of Object.entries(resourceMapping)) {
        const keywords = pattern.split('|');
        const matches = keywords.some(kw => promptLower.includes(kw.toLowerCase()));
        if (matches) {
            resources.add(resourceFile);
        }
    }

    return Array.from(resources);
}

async function main() {
    try {
        // Read input from stdin
        const input = readFileSync(0, 'utf-8');
        const data: HookInput = JSON.parse(input);
        const prompt = data.prompt.toLowerCase();

        // Load skill rules
        const projectDir = process.env.CLAUDE_PROJECT_DIR || '$HOME/project';
        const rulesPath = join(projectDir, '.claude', 'skills', 'skill-rules.json');
        const rules: SkillRules = JSON.parse(readFileSync(rulesPath, 'utf-8'));

        const matchedSkills: MatchedSkill[] = [];

        // Check each skill for matches
        for (const [skillName, config] of Object.entries(rules.skills)) {
            const triggers = config.promptTriggers;
            if (!triggers) {
                continue;
            }

            let matchType: 'keyword' | 'intent' | null = null;
            let matchedOn = '';

            // Keyword matching
            if (triggers.keywords) {
                const matched = triggers.keywords.find(kw => prompt.includes(kw.toLowerCase()));
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

        // Generate output if matches found
        if (matchedSkills.length > 0) {
            // Sort by priority
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            matchedSkills.sort((a, b) => 
                priorityOrder[a.config.priority] - priorityOrder[b.config.priority]
            );

            let output = '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
            output += '🎯 SKILL ACTIVATION\n';
            output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

            for (const skill of matchedSkills.slice(0, 2)) {
                const icon = { critical: '🚨', high: '📚', medium: '💡', low: '📌' }[skill.config.priority];

                output += `${icon} ${skill.name}\n`;
                output += `   ↳ Matched: "${skill.matchedOn}" (${skill.matchType})\n`;

                if (skill.relevantResources.length > 0) {
                    output += `   📄 Resources:\n`;
                    skill.relevantResources.forEach(r => {
                        output += `      • resources/${r}\n`;
                    });
                }
                output += '\n';
            }

            output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
            output += '📖 Read skill + resources BEFORE responding\n';
            output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

            console.log(output);
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