#!/usr/bin/env bash
# ============================================================
#  Alef.FiT - one-time Git initialization (Git Bash / macOS / Linux).
#  Run from the project root:   bash init_git.sh
#  Requires Git installed.
# ============================================================
set -e
cd "$(dirname "$0")"

# Windows has a 260-char path limit; the FitnessApp reference images
# have very long names, so enable long-path support (harmless elsewhere).
git config --global core.longpaths true || true

git init -b main
git config user.name "Alef AI"
git config user.email "alefinnovation@gmail.com"
git add -A
git commit -m "chore: project scaffold, architecture, and docs"
git tag -a v0.1.0 -m "v0.1.0 - scaffold, architecture & planning docs"

echo
echo "------------------------------------------------------------"
echo " Done: branch 'main', first commit created, tag v0.1.0."
echo " Next: create a PRIVATE repo on GitHub, then run:"
echo "    git remote add origin <your-private-repo-url>"
echo "    git push -u origin main --tags"
echo "------------------------------------------------------------"
echo
git --no-pager log --oneline
git tag -l
