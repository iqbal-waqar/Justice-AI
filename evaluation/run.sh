#!/usr/bin/env bash
# One command for a full evaluation: ask the questions, then score them.
#   evaluation/run.sh                      # all questions
#   evaluation/run.sh --limit 5            # first 5
#   evaluation/run.sh --label "after prompt change"
set -euo pipefail
cd "$(dirname "$0")/.."
venv/bin/python evaluation/collect.py "$@"
evaluation/.venv/bin/python evaluation/score.py --latest
