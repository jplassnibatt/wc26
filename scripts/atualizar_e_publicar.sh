#!/bin/zsh
# Atualiza e publica o calendário do Mundial 2026.
# Corrido pelo launchd diariamente durante as eliminatórias.
# - Regenera public/mundial2026.ics a partir de scripts/gerar_ics.py
# - Se mudou, faz commit + push (dispara deploy do GitHub Pages)
# - Notifica no Mac para lembrar de atualizar as equipas das eliminatórias
set -e
REPO="/Users/nunomartins/Desktop/wc26"
LOG="$REPO/scripts/atualizar.log"
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin:$PATH"

echo "----- $(date '+%Y-%m-%d %H:%M') -----" >> "$LOG"

# Janela: só agir entre 28/jun e 19/jul de 2026 (ISO compara bem como string)
today=$(date +%Y-%m-%d)
if [[ "$today" < "2026-06-28" || "$today" > "2026-07-19" ]]; then
  echo "fora da janela das eliminatórias ($today) — nada a fazer" >> "$LOG"
  exit 0
fi

cd "$REPO" || { echo "repo não encontrado" >> "$LOG"; exit 1; }

git pull --rebase --quiet >> "$LOG" 2>&1 || echo "git pull falhou (continuo)" >> "$LOG"

/usr/bin/python3 scripts/gerar_ics.py >> "$LOG" 2>&1

if ! git diff --quiet public/mundial2026.ics 2>/dev/null; then
  echo "calendário mudou — a publicar" >> "$LOG"
  git add public/mundial2026.ics scripts/gerar_ics.py
  git commit -q -m "Atualizar calendário Mundial 2026 (auto)" >> "$LOG" 2>&1
  if git push -q origin main >> "$LOG" 2>&1; then
    echo "push OK" >> "$LOG"
    osascript -e 'display notification "Calendário atualizado e publicado." with title "Mundial 2026 ⚽" sound name "Glass"' 2>/dev/null || true
  else
    echo "push FALHOU" >> "$LOG"
    osascript -e 'display notification "Falha ao publicar — abre o Claude Code." with title "Mundial 2026 ⚠️"' 2>/dev/null || true
  fi
else
  echo "sem mudanças no calendário" >> "$LOG"
fi

# Lembrete diário para fazer a atualização inteligente das equipas
osascript -e 'display notification "Abre o Claude Code e diz: \"atualiza as eliminatórias do Mundial\"" with title "Mundial 2026 — atualizar equipas"' 2>/dev/null || true
echo "fim" >> "$LOG"
