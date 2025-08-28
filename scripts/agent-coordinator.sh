#!/bin/bash

# Packr Agent Coordination Script
# Helps manage multiple AI agents working on the codebase safely

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOCK_DIR="$PROJECT_ROOT/.agent-locks"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Ensure lock directory exists
mkdir -p "$LOCK_DIR"

# Function to create agent work lock
create_lock() {
    local agent_name="$1"
    local files_list="$2"
    local estimated_time="$3"
    local branch_name="$(git branch --show-current)"
    
    local lock_file="$LOCK_DIR/${agent_name}.lock"
    
    if [[ -f "$lock_file" ]]; then
        error "Agent $agent_name already has an active lock"
        cat "$lock_file"
        return 1
    fi
    
    cat > "$lock_file" << EOF
{
    "agent": "$agent_name",
    "branch": "$branch_name",
    "files": "$files_list",
    "start_time": "$(date -Iseconds)",
    "estimated_completion": "$(date -d "+$estimated_time" -Iseconds)",
    "pid": $$
}
EOF
    
    success "Created work lock for $agent_name"
    log "Files: $files_list"
    log "Branch: $branch_name"
    log "Estimated time: $estimated_time"
}

# Function to remove agent work lock
remove_lock() {
    local agent_name="$1"
    local lock_file="$LOCK_DIR/${agent_name}.lock"
    
    if [[ -f "$lock_file" ]]; then
        rm "$lock_file"
        success "Removed work lock for $agent_name"
    else
        warn "No lock found for $agent_name"
    fi
}

# Function to check for file conflicts
check_conflicts() {
    local target_files="$1"
    
    log "Checking for file conflicts..."
    
    local conflicts_found=false
    
    # Check each active lock for file conflicts
    for lock_file in "$LOCK_DIR"/*.lock; do
        if [[ ! -f "$lock_file" ]]; then
            continue
        fi
        
        local locked_files=$(jq -r '.files' "$lock_file" 2>/dev/null || echo "")
        local agent_name=$(jq -r '.agent' "$lock_file" 2>/dev/null || echo "unknown")
        
        # Simple string matching for file conflicts
        IFS=',' read -ra TARGET_ARRAY <<< "$target_files"
        IFS=',' read -ra LOCKED_ARRAY <<< "$locked_files"
        
        for target_file in "${TARGET_ARRAY[@]}"; do
            for locked_file in "${LOCKED_ARRAY[@]}"; do
                if [[ "$target_file" == "$locked_file" ]]; then
                    error "File conflict detected: $target_file"
                    error "Currently locked by agent: $agent_name"
                    conflicts_found=true
                fi
            done
        done
    done
    
    if [[ "$conflicts_found" == "false" ]]; then
        success "No file conflicts detected"
        return 0
    else
        return 1
    fi
}

# Function to list active agents
list_active() {
    log "Active agent work sessions:"
    
    if [[ ! "$(ls -A $LOCK_DIR 2>/dev/null)" ]]; then
        log "No active agents"
        return
    fi
    
    for lock_file in "$LOCK_DIR"/*.lock; do
        if [[ ! -f "$lock_file" ]]; then
            continue
        fi
        
        local agent_name=$(jq -r '.agent' "$lock_file" 2>/dev/null || echo "unknown")
        local branch_name=$(jq -r '.branch' "$lock_file" 2>/dev/null || echo "unknown")
        local start_time=$(jq -r '.start_time' "$lock_file" 2>/dev/null || echo "unknown")
        local files=$(jq -r '.files' "$lock_file" 2>/dev/null || echo "unknown")
        
        echo ""
        echo "🤖 Agent: $agent_name"
        echo "🌿 Branch: $branch_name"
        echo "⏰ Started: $start_time"  
        echo "📁 Files: $files"
        echo "---"
    done
}

# Function to clean up stale locks
cleanup_stale() {
    log "Cleaning up stale agent locks..."
    
    for lock_file in "$LOCK_DIR"/*.lock; do
        if [[ ! -f "$lock_file" ]]; then
            continue
        fi
        
        local agent_name=$(basename "$lock_file" .lock)
        local pid=$(jq -r '.pid' "$lock_file" 2>/dev/null || echo "0")
        
        # Check if process is still running
        if ! kill -0 "$pid" 2>/dev/null; then
            warn "Found stale lock for $agent_name (PID $pid no longer running)"
            rm "$lock_file"
            success "Cleaned up stale lock for $agent_name"
        fi
    done
}

# Function to run coordinated tests
run_tests() {
    local test_scope="$1"
    local agent_name="$2"
    
    log "Running $test_scope tests for $agent_name..."
    
    # Check if any other agent is currently running tests
    if pgrep -f "npm test" > /dev/null; then
        error "Another test process is already running. Please wait."
        return 1
    fi
    
    case "$test_scope" in
        "api")
            log "Running API tests..."
            cd "$PROJECT_ROOT/apps/api"
            npm test -- --coverage --verbose
            ;;
        "web")
            log "Running frontend tests..."
            cd "$PROJECT_ROOT/apps/web" 
            npm test -- --run --coverage
            ;;
        "integration")
            log "Running integration tests..."
            cd "$PROJECT_ROOT/apps/api"
            npm test -- --testPathPattern="integration" --coverage
            ;;
        "all")
            log "Running full test suite..."
            run_tests "api" "$agent_name"
            run_tests "web" "$agent_name" 
            run_tests "integration" "$agent_name"
            ;;
        *)
            error "Unknown test scope: $test_scope"
            return 1
            ;;
    esac
    
    success "Tests completed for $test_scope"
}

# Function to check system health
health_check() {
    log "Running system health check..."
    
    local issues_found=false
    
    # Check database connectivity
    if ! psql "${DATABASE_URL:-postgresql://packr:password@localhost:5432/packr_dev}" -c "SELECT 1;" >/dev/null 2>&1; then
        error "Database connection failed"
        issues_found=true
    else
        success "Database connection OK"
    fi
    
    # Check Redis connectivity
    if ! redis-cli ping >/dev/null 2>&1; then
        error "Redis connection failed"
        issues_found=true
    else
        success "Redis connection OK"
    fi
    
    # Check API health (if running)
    if curl -f "http://localhost:3000/health" >/dev/null 2>&1; then
        success "API health check OK"
    else
        warn "API not running or health check failed"
    fi
    
    # Check disk space
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [[ $disk_usage -gt 90 ]]; then
        error "Disk usage critical: ${disk_usage}%"
        issues_found=true
    else
        success "Disk usage OK: ${disk_usage}%"
    fi
    
    # Check for uncommitted changes
    if [[ -n "$(git status --porcelain)" ]]; then
        warn "Uncommitted changes detected"
        git status --short
    else
        success "Working directory clean"
    fi
    
    if [[ "$issues_found" == "false" ]]; then
        success "All health checks passed"
        return 0
    else
        error "Health check issues detected"
        return 1
    fi
}

# Function to generate agent work report
generate_report() {
    local agent_name="$1"
    local report_file="$PROJECT_ROOT/.agent-reports/${agent_name}-$(date +%Y%m%d-%H%M%S).md"
    
    mkdir -p "$(dirname "$report_file")"
    
    cat > "$report_file" << EOF
# Agent Work Report: $agent_name

**Generated**: $(date -Iseconds)
**Branch**: $(git branch --show-current)
**Commit**: $(git rev-parse HEAD)

## Changes Summary
$(git log --oneline -10)

## Files Modified  
$(git diff --name-only HEAD~1)

## Test Results
\`\`\`
$(npm test 2>&1 | tail -20 || echo "Tests not run")
\`\`\`

## Code Quality
- TypeScript: $(npx tsc --noEmit >/dev/null 2>&1 && echo "✅ Pass" || echo "❌ Fail")
- Linting: $(npm run lint >/dev/null 2>&1 && echo "✅ Pass" || echo "❌ Fail")
- Formatting: $(npm run format:check >/dev/null 2>&1 && echo "✅ Pass" || echo "❌ Fail")

## Next Steps
- [ ] Code review requested
- [ ] Tests passing
- [ ] Documentation updated
- [ ] Ready for merge

EOF
    
    success "Generated work report: $report_file"
}

# Main function
main() {
    case "${1:-}" in
        "lock")
            if [[ $# -ne 4 ]]; then
                error "Usage: $0 lock <agent_name> <files_csv> <estimated_time>"
                exit 1
            fi
            create_lock "$2" "$3" "$4"
            ;;
        "unlock")
            if [[ $# -ne 2 ]]; then
                error "Usage: $0 unlock <agent_name>"
                exit 1
            fi
            remove_lock "$2"
            ;;
        "conflicts")
            if [[ $# -ne 2 ]]; then
                error "Usage: $0 conflicts <files_csv>"
                exit 1
            fi
            check_conflicts "$2"
            ;;
        "list")
            list_active
            ;;
        "cleanup")
            cleanup_stale
            ;;
        "test")
            if [[ $# -ne 3 ]]; then
                error "Usage: $0 test <scope> <agent_name>"
                error "Scopes: api, web, integration, all"
                exit 1
            fi
            run_tests "$2" "$3"
            ;;
        "health")
            health_check
            ;;
        "report")
            if [[ $# -ne 2 ]]; then
                error "Usage: $0 report <agent_name>"
                exit 1
            fi
            generate_report "$2"
            ;;
        *)
            cat << EOF
Packr Agent Coordinator

Usage: $0 <command> [options]

Commands:
  lock <agent> <files> <time>     Create work lock for agent
  unlock <agent>                  Remove work lock for agent  
  conflicts <files>               Check for file conflicts
  list                           List active agents
  cleanup                        Remove stale locks
  test <scope> <agent>           Run coordinated tests
  health                         Check system health
  report <agent>                 Generate work report

Examples:
  $0 lock background-agent "apps/api/src/routes/orders.ts" "30min"
  $0 conflicts "apps/api/src/routes/orders.ts,apps/web/src/components/OrdersList.tsx"
  $0 test api background-agent
  $0 unlock background-agent

EOF
            ;;
    esac
}

# Run main function with all arguments
main "$@"