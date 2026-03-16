#!/bin/bash
# EM Pipeline Runner — calls orchestrator repeatedly until all phases complete
WEBHOOK="http://localhost:5678/webhook/EQevFbE3p71rqif4/webhook/ae/em-orchestrator"
STATE_FILE="/mnt/d/NAS-DATA/antenna-engine/.claude/em-pipeline-state.json"
MAX_ITERATIONS=50

echo "=== EM Pipeline Runner ==="
echo "Start: $(date)"

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "--- Iteration $i ---"

  # Check current state
  CURRENT=$(python3 -c "
import json
state = json.load(open('$STATE_FILE'))
phases = state['phases']
done = sum(1 for p in phases.values() if p['status'] == 'complete')
total = len(phases)
current = state.get('currentPhase', 'none')
aborted = any(p['attempts'] >= state.get('maxRetries', 3) for p in phases.values() if p['status'] == 'failed')
if done == total:
    print('ALL_DONE')
elif aborted:
    print('ABORTED')
elif current is None:
    print('ALL_DONE')
else:
    print(f'PHASE:{current}:{done}/{total}')
" 2>/dev/null)

  echo "State: $CURRENT"

  if [ "$CURRENT" = "ALL_DONE" ]; then
    echo "Pipeline COMPLETE!"
    break
  fi
  if [ "$CURRENT" = "ABORTED" ]; then
    echo "Pipeline ABORTED (max retries reached)"
    break
  fi

  # Call orchestrator
  echo "Calling orchestrator..."
  RESULT=$(curl -s "$WEBHOOK" -X POST \
    -H "Content-Type: application/json" \
    -d '{"trigger":"pipeline-runner","iteration":'$i'}' \
    --max-time 900 2>/dev/null)

  echo "Response: $(echo "$RESULT" | head -c 200)"

  # Wait between iterations — orchestrator takes ~2 min per phase
  sleep 30
done

echo ""
echo "=== Final State ==="
python3 -c "
import json
state = json.load(open('$STATE_FILE'))
for phase, info in state['phases'].items():
    status = info['status']
    attempts = info['attempts']
    emoji = '✓' if status == 'complete' else '✗' if status == 'failed' else '○'
    print(f'  {emoji} {phase}: {status} ({attempts} attempts)')
"
echo "End: $(date)"
