#!/bin/bash
# Stop hook: Run TypeScript compilation on affected services
# Reads affected repos from post-tool-use-tracker cache and runs tsc --noEmit

# Read stdin for session info
tool_info=$(cat)
session_id=$(echo "$tool_info" | jq -r '.session_id // empty')

if [[ -z "$session_id" ]]; then
    exit 0
fi

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cache_dir="$project_dir/.claude/tsc-cache/${session_id}"
repos_file="$cache_dir/affected-repos.txt"

# Skip if no affected repos tracked
if [[ ! -f "$repos_file" ]] || [[ ! -s "$repos_file" ]]; then
    exit 0
fi

# Python-only repos (skip tsc)
PYTHON_REPOS="services"

# Map repo names to tsc commands
get_tsc_cmd() {
    local repo="$1"
    local repo_path="$project_dir/$repo"

    # Skip Python repos
    if [[ "$repo" == "services" ]] || [[ "$repo" == services/* ]]; then
        echo ""
        return
    fi

    # Skip repos without tsconfig
    if [[ ! -f "$repo_path/tsconfig.json" ]]; then
        echo ""
        return
    fi

    # Vite/React projects use tsconfig.app.json
    if [[ -f "$repo_path/tsconfig.app.json" ]]; then
        echo "npx tsc --project tsconfig.app.json --noEmit"
    else
        echo "npx tsc --noEmit"
    fi
}

# Collect repos that need checking
declare -a ts_repos=()
while IFS= read -r repo; do
    [[ -z "$repo" ]] && continue
    cmd=$(get_tsc_cmd "$repo")
    if [[ -n "$cmd" ]]; then
        ts_repos+=("$repo")
    fi
done < "$repos_file"

# Nothing to check
if [[ ${#ts_repos[@]} -eq 0 ]]; then
    exit 0
fi

# Run checks
passed=0
failed=0
output=""

for repo in "${ts_repos[@]}"; do
    repo_path="$project_dir/$repo"
    cmd=$(get_tsc_cmd "$repo")

    # Check node_modules exist
    if [[ ! -d "$repo_path/node_modules" ]]; then
        output+="  ⚠️  $repo: SKIPPED (node_modules missing)\n"
        continue
    fi

    # Run tsc with timeout
    tsc_output=$(cd "$repo_path" && timeout 45 $cmd 2>&1)
    exit_code=$?

    if [[ $exit_code -eq 124 ]]; then
        output+="  ⏱️  $repo: TIMEOUT (>45s)\n"
        ((failed++))
    elif [[ $exit_code -eq 0 ]]; then
        output+="  ✅ $repo: 0 errors\n"
        ((passed++))
    else
        error_count=$(echo "$tsc_output" | grep -c "error TS")
        output+="  ❌ $repo: $error_count errors\n"
        # Show first 5 errors
        echo "$tsc_output" | grep "error TS" | head -5 | while read -r line; do
            output+="     $line\n"
        done
        ((failed++))
    fi
done

# Format final output
total=$((passed + failed))
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 TypeScript Check (affected services)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "$output"

if [[ $failed -gt 0 ]]; then
    echo "$passed passed, $failed failed"
else
    echo "All $total services passed ✅"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit 0
