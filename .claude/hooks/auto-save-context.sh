#!/bin/bash
# Stop hook: Auto-save session context for active tasks
# Writes a session snapshot to dev/active/{task}/ for resume continuity

# Read stdin for session info
tool_info=$(cat)
session_id=$(echo "$tool_info" | jq -r '.session_id // empty')

if [[ -z "$session_id" ]]; then
    exit 0
fi

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
active_dir="$project_dir/dev/active"

# Skip if no active tasks directory
if [[ ! -d "$active_dir" ]]; then
    exit 0
fi

# Find active task directories
task_dirs=()
for dir in "$active_dir"/*/; do
    [[ -d "$dir" ]] && task_dirs+=("$dir")
done

# No active tasks
if [[ ${#task_dirs[@]} -eq 0 ]]; then
    exit 0
fi

# Read session data from post-tool-use-tracker cache
cache_dir="$project_dir/.claude/tsc-cache/${session_id}"
edited_log="$cache_dir/edited-files.log"
repos_file="$cache_dir/affected-repos.txt"

# Collect edited files (unique, relative paths)
files_edited="[]"
edit_count=0
if [[ -f "$edited_log" ]]; then
    edit_count=$(wc -l < "$edited_log" | tr -d ' ')
    # Extract unique file paths, make relative
    files_edited=$(awk -F: '{print $2}' "$edited_log" 2>/dev/null \
        | sed "s|$project_dir/||g" \
        | sort -u \
        | jq -R . \
        | jq -s .)
fi

# Nothing edited this session: don't overwrite existing (richer) snapshots
if [[ "$edit_count" -eq 0 ]]; then
    exit 0
fi

# Collect affected repos
affected_repos="[]"
if [[ -f "$repos_file" ]]; then
    affected_repos=$(cat "$repos_file" | jq -R . | jq -s .)
fi

# Count unique files
file_count=$(echo "$files_edited" | jq 'length')

# Build resume hint
repos_list=$(echo "$affected_repos" | jq -r 'join(", ")')
resume_hint="Session edited $file_count unique files across $repos_list."

# Current timestamp
saved_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Scope to relevant tasks: those whose dev/active/<task>/ files were edited
# this session (previously broadcast to EVERY active task, overwriting good
# snapshots with unrelated ones). Fallback: dev/active/.last-session-snapshot.json
relevant_dirs=()
for task_dir in "${task_dirs[@]}"; do
    task_name=$(basename "$task_dir")
    if echo "$files_edited" | jq -e --arg t "dev/active/$task_name/" 'map(startswith($t)) | any' > /dev/null; then
        relevant_dirs+=("$task_dir")
    fi
done

if [[ ${#relevant_dirs[@]} -eq 0 ]]; then
    relevant_dirs=("$active_dir/.")
fi

# Write snapshot to each relevant task
for task_dir in "${relevant_dirs[@]}"; do
    if [[ "$task_dir" == "$active_dir/." ]]; then
        task_name="last-session"
        snapshot_path="$active_dir/.last-session-snapshot.json"
    else
        task_name=$(basename "$task_dir")
        snapshot_path="$task_dir/${task_name}-session-snapshot.json"
    fi

    jq -n \
        --arg sid "$session_id" \
        --arg saved "$saved_at" \
        --argjson repos "$affected_repos" \
        --argjson files "$files_edited" \
        --argjson fc "$file_count" \
        --argjson ec "$edit_count" \
        --arg hint "$resume_hint" \
        '{
            session_id: $sid,
            saved_at: $saved,
            affected_repos: $repos,
            files_edited: $files,
            file_count: $fc,
            edit_count: $ec,
            resume_hint: $hint
        }' > "$snapshot_path" 2>/dev/null
done

# Output confirmation
task_names=$(printf '%s\n' "${relevant_dirs[@]}" | xargs -I{} basename {} | paste -sd, - | sed 's/^\.$/last-session (no task-scoped edits)/')
echo ""
echo "💾 Session snapshot saved for: $task_names"
echo "   Files: $file_count | Edits: $edit_count | Repos: $repos_list"

exit 0
