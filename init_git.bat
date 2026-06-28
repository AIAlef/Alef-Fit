@echo off
REM ============================================================
REM  Alef.FiT - one-time Git initialization (Windows).
REM  Double-click this file, or run it from a terminal in the
REM  project root. Requires "Git for Windows".
REM ============================================================
cd /d "%~dp0"

REM Windows has a 260-char path limit. The FitnessApp reference
REM images have very long names, so enable git long-path support
REM FIRST or "git add" will fail with "Filename too long".
git config --global core.longpaths true
git config core.longpaths true

git init -b main
git config user.name "Alef AI"
git config user.email "alefinnovation@gmail.com"
git config core.autocrlf true

git add -A
if errorlevel 1 (
  echo.
  echo !! git add failed - see the error above. Nothing was committed.
  echo    If it says "Filename too long", run this once then retry:
  echo        git config --global core.longpaths true
  echo.
  pause
  exit /b 1
)

git commit -m "chore: project scaffold, architecture, and docs"
if errorlevel 1 (
  echo.
  echo !! git commit failed - see the error above.
  pause
  exit /b 1
)

git tag -a v0.1.0 -m "v0.1.0 - scaffold, architecture & planning docs" 2>nul

echo.
echo ------------------------------------------------------------
echo  Done: branch "main", first commit created, tag v0.1.0.
echo  Next: create a PRIVATE repo on GitHub, then run:
echo     git remote add origin ^<your-private-repo-url^>
echo     git push -u origin main --tags
echo ------------------------------------------------------------
echo.
git --no-pager log --oneline
git tag -l
echo.
pause
