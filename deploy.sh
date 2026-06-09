#!/bin/bash
set -e

MSG="${1:-update}"

git add -A
git commit -m "$MSG" 2>/dev/null || echo "Nothing to commit"
git push
firebase deploy --only hosting
