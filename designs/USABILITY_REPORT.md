# Relatório de Usabilidade & Boas Práticas de UI — WC26

**App:** FIFA World Cup 2026 — bolão mobile-first (React 19 + Vite + Firebase, CSS vanilla, framer-motion)
**Data:** 2026-06-22
**Âmbito:** Auditoria de usabilidade, acessibilidade (WCAG 2.1 AA) e boas práticas de UI sobre o código em `src/`.
**Método:** Revisão de componentes, `src/App.css` (4437 linhas), `src/index.css`, padrões de ARIA/semântica, alvos de toque, foco, contraste e movimento.

> Este documento é vivo. À medida que os pontos forem resolvidos, marca a checkbox e referencia o commit/PR.

> **Estado (2026-06-22):** ✅ Todos os pontos resolvidos — Sprint 1 (foco/modais, `:focus-visible`, reduced-motion), Sprint 2 (alvos de toque, equipas como `<button>`, `inputmode`, autocomplete) e Sprint 3 (follow-up `TeamCard`/tabelas, contraste do dourado, skeletons).

---

## 1. Sumário executivo

A base está **acima da média** para um projeto pessoal: HTML semântico (0 `onClick` em `div`, 91 `<button>`), `aria-label` em ícones, `alt` correto em bandeiras, suporte a dark mode, *safe-area insets* para iOS, `ErrorBoundary` global e inputs a 16px (evita zoom no iOS). Os problemas concentram-se em **gestão de foco em modais**, **alvos de toque pequenos**, **ausência de `prefers-reduced-motion`** e alguns casos de **contraste do dourado**.

### Veredicto por dimensão

| Dimensão | Estado | Nota |
|---|---|---|
| HTML semântico | 🟢 Bom | `<button>` em todo o lado, sem `div` clicável |
| Alvos de toque | 🟡 A melhorar | 3–4 botões abaixo de 44px |
| Foco & teclado | 🔴 Lacuna | Sem *focus trap*/Escape nos modais; `:focus` em vez de `:focus-visible` |
| Formulários & labels | 🟢 Bom | Falta `inputmode` nos placares; roles no autocomplete |
| Imagens & alt | 🟢 Bom | Nada a corrigir |
| Contraste & dark mode | 🟡 A melhorar | Dourado como texto em fundo claro (~3.5:1) |
| Movimento | 🔴 Lacuna | `prefers-reduced-motion` em 0 ficheiros |
| Estados (loading/erro) | 🟢 Bom | Sem skeletons (cosmético) |
| Responsivo / layout | 🟢 Bom | Bem resolvido |

**Contagem:** 🔴 5 *high* · 🟡 8 *medium* · 🟢 3 *low*.

---

## 2. O que já está bem feito ✅

1. **Semântica** — uso exclusivo de `<button>`/`<input>`; sem `div` com `onClick`.
2. **`alt` correto** — bandeiras informativas com `alt={teamName}`; decorativas com `alt=""` (`BracketPredictor`, `GroupTable`, `TournamentStats`).
3. **`aria-label`** em botões só-ícone (favorito, fechar, calendário).
4. **iOS** — `viewport-fit=cover` ([index.html:10](index.html)), `env(safe-area-inset-*)` no header e bottom-nav, fonte de input a 16px (sem zoom no focus).
5. **`ErrorBoundary`** global evita white-screen em crash.
6. **Feedback de gravação** no `BetCard` com spinner/check/erro e `aria-live="polite"`.
7. **Dark mode** completo seguindo `prefers-color-scheme`, com tokens ajustados.
8. **`max-width` ~430px** + `overflow-x: clip` evitam overflow horizontal mantendo *sticky*.

---

## 3. Prioridade ALTA 🔴

### 3.1 Modais sem *focus trap* nem Escape-to-close
**Onde:** `ConfirmModal.jsx`, `NicknameModal.jsx`, `AuthScreen.jsx`, `HamburgerMenu.jsx`
**Problema:** O teclado sai do modal para a página por baixo; não há tecla Escape para fechar; foco não entra no modal ao abrir. Viola gestão de foco WCAG 2.1 AA.
**Fix:**
- `role="dialog" aria-modal="true"` + `aria-labelledby`/`aria-describedby`.
- Mover foco para o 1.º elemento ao abrir; restaurar ao fechar.
- Escape fecha; Tab/Shift+Tab faz ciclo dentro do modal.

> ✅ **Resolvido (Sprint 1)** — hook `src/hooks/useModalA11y.js` aplicado a `ConfirmModal`, `NicknameModal`, `AuthScreen` (3 passos, re-arma via `key`) e `HamburgerMenu` (com `inert`/`aria-hidden` quando fechado). Inclui `role="dialog"`, `aria-modal`, `aria-labelledby`/`aria-describedby`, foco inicial e Escape.

```jsx
// hook reutilizável useModalA11y(ref, onClose)
useEffect(() => {
  const el = ref.current; if (!el) return;
  const prev = document.activeElement;
  const focusables = () => el.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
  focusables()[0]?.focus();
  const onKey = (e) => {
    if (e.key === 'Escape') return onClose();
    if (e.key !== 'Tab') return;
    const f = focusables(); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  el.addEventListener('keydown', onKey);
  return () => { el.removeEventListener('keydown', onKey); prev?.focus?.(); };
}, [ref, onClose]);
```
- [x] Resolvido

### 3.2 `outline: none` sem substituto visível para teclado
**Onde:** `App.css:504, 1219, 2059, 3184` (e variantes)
**Problema:** Remove-se o outline e substitui-se só por mudança de cor de borda — subtil demais para quem navega por teclado.
**Fix:** Trocar `:focus` por `:focus-visible` e adicionar anel explícito:
```css
:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
/* ou box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold) 40%, transparent); */
```
- [x] Resolvido

### 3.3 `prefers-reduced-motion` em falta
**Onde:** transições de página em `App.jsx`, `BottomNav` (framer-motion `scale`), keyframes em `App.css` (`cardIn`, `pulse`, …)
**Problema:** Utilizadores com sensibilidade vestibular não têm forma de reduzir animações.
**Fix global (index.css):**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```
E no framer-motion usar `useReducedMotion()` para anular `animate`.
- [x] Resolvido

### 3.4 Alvos de toque < 44px (botões críticos)
**Onde / atual:**
- `.team-card__fav` → 30×30px ([App.css:606](src/App.css)) — toggle de favorito (uso frequente)
- `.install-banner__close` → 28×28px ([App.css:2549](src/App.css))
- `.hamburger-menu__close` → 32×32px ([App.css:861](src/App.css))

**Problema:** Abaixo do mínimo recomendado de 44×44px (WCAG 2.5.5 / iOS HIG). Botão de favorito a 30px é o mais sensível.
**Fix:** `min-width: 44px; min-height: 44px;` (a área de toque pode exceder o ícone visual via padding/`::before` transparente para não engordar o layout).
> ✅ **Resolvido (Sprint 2)** — `.team-card__fav` → 44px; `.hamburger-menu__close` e `.install-banner__close` mantêm o círculo visível (32/28px via `::before`) com área de toque 44px; `.autocomplete__clear` → 44px; `.pool-selector__trigger` → 36px.
- [x] Resolvido

### 3.5 Cartões de equipa "clicáveis" não acessíveis por teclado
**Onde:** `BetCard.jsx:96,127`; `MatchCard.jsx:73,95` (`<div className="…__team" onClick>` + `cursor:pointer`)
**Problema:** Navega para o perfil da equipa mas não é focável nem ativável por teclado/leitor de ecrã. (É a única exceção ao "0 div clicável".)
**Fix:** Converter em `<button type="button">` com `aria-label={`Ver perfil de ${homeName}`}` e remover o `style={{cursor:'pointer'}}`.
> ✅ **Resolvido (Sprint 2)** — `BetCard` e `MatchCard` usam `<button>` (nome acessível vem do texto da equipa; bandeira passou a `alt=""` decorativa; `disabled` quando knockout/sem handler).
> ✅ **Follow-up resolvido (Sprint 3)** — `TeamCard` reestruturado em `team-card__main` (`<button>`) + botão de favorito irmão (sem aninhar botões); `GroupTable` e `TournamentStats` (top scorers + defesas) com o nome da equipa como `<button>` focável (`group-table__team-link`/`stats-scorers__name`), `stopPropagation` para o `onClick` da linha continuar a servir o rato.
- [x] Resolvido

---

## 4. Prioridade MÉDIA 🟡

### 4.1 Placares sem `inputmode="numeric"`
**Onde:** `BetCard.jsx:106–124` (`<input type="number">`)
**Fix:** adicionar `inputmode="numeric"` (teclado numérico no telemóvel; só são precisos inteiros 0–N).
> ✅ **Resolvido (Sprint 2)** — `inputMode="numeric"` nos dois inputs de placar do `BetCard`.
- [x] Resolvido

### 4.2 Autocomplete sem roles de listbox
**Onde:** `Autocomplete.jsx`
**Problema:** setas funcionam, mas a lista/itens não expõem `role="listbox"`/`role="option"` nem `aria-selected`/`aria-activedescendant` — leitores de ecrã não anunciam o item ativo.
**Fix:** `role="listbox"` na `<ul>`, `role="option" aria-selected={i===active}` nos `<li>`, e `aria-activedescendant` no input.
> ✅ **Resolvido (Sprint 2)** — input com `role="combobox"` + `aria-expanded`/`aria-controls`/`aria-autocomplete`/`aria-activedescendant`; `<ul role="listbox">` e `<li role="option" aria-selected>` com ids únicos via `useId`.
- [x] Resolvido

### 4.3 Contraste do dourado como texto em fundo claro
**Onde:** `.rules__section-title` ([App.css:1051](src/App.css)) usa `var(--gold)` (~#C9A84C) sobre `--surface` (branco) ≈ **3.5:1** (falha AA para texto < 18pt).
**Nota:** Já existe o tom escuro `#8B7226`/`#8a6d1e` usado corretamente nos badges (`App.css:1121, 2117, 3415`).
**Fix:** usar o dourado escuro para *texto* em fundo claro (manter o dourado claro só para fundos escuros / acentos grandes).
> ✅ **Resolvido (Sprint 3)** — novo token `--gold-text` (`#8A6D1E` em claro ≈ 4.6:1, `#D6B65F` em escuro) aplicado a `.rules__section-title` e aos marcadores das listas de regras. O `--gold` continua para acentos/fundos escuros.
- [x] Resolvido

### 4.4 Modais sem `role`/labels ARIA
**Onde:** `ConfirmModal.jsx`, `HamburgerMenu.jsx`
**Fix:** `role="dialog" aria-modal="true"` + `aria-labelledby`/`aria-describedby` (liga ao título e mensagem). (Acompanha 3.1.)
- [x] Resolvido

### 4.5 Skeletons em vez de "Carregando…"
**Onde:** `Bets.jsx`, `MyMatches.jsx`
**Problema:** texto simples durante o fetch; sem indicação da estrutura.
**Fix:** componente `SkeletonCard` (3–4 placeholders) — perceção de velocidade melhor. *(Cosmético, não bloqueia.)*
> ✅ **Resolvido (Sprint 3)** — `SkeletonBetCard`/`SkeletonBetList` (5 placeholders com a silhueta do `BetCard` + sheen, congelado por reduced-motion) no estado de loading do `Bets.jsx`. `MyMatches.jsx` não tem fetch assíncrono (parte do schedule local + favoritos), por isso não precisa.
- [x] Resolvido

### 4.6 Foco inicial no `ConfirmModal`
**Onde:** `ConfirmModal.jsx`
**Fix:** `autoFocus` no botão primário (ou foco programático no mount). Coberto por 3.1 se usares o hook.
- [x] Resolvido

---

## 5. Prioridade BAIXA 🟢

- ✅ **`.pool-selector__trigger`** — agora `min-height: 36px` (Sprint 2).
- ✅ **`.autocomplete__clear`** — agora 44×44px (Sprint 2).
- ✅ **`:focus-visible` no `.lang-switcher`** — coberto pelo `:focus-visible` global (Sprint 1).

---

## 6. Plano de ação sugerido

**Sprint 1 — Acessibilidade core (1 PR):**
1. Hook `useModalA11y` aplicado aos 4 modais (3.1, 4.4, 4.6).
2. `:focus-visible` global + anel de foco (3.2).
3. `@media (prefers-reduced-motion)` + `useReducedMotion()` (3.3).

**Sprint 2 — Toque & teclado (1 PR):**
4. Alvos de toque ≥44px (3.4, low de §5).
5. Cartões de equipa → `<button>` (3.5).
6. `inputmode="numeric"` + roles do autocomplete (4.1, 4.2).

**Sprint 3 — Polimento:**
7. Contraste do dourado (4.3).
8. Skeletons (4.5).

---

## 7. Referência — checklist de boas práticas de mercado

Padrão para validar features novas (mobile-first, PWA):

- [ ] **Toque:** alvos ≥44×44px, espaçados ≥8px.
- [ ] **Foco:** `:focus-visible` visível em tudo o que é interativo; foco gerido em overlays.
- [ ] **Teclado:** tudo operável sem rato; Escape fecha overlays; Enter/Espaço ativam.
- [ ] **Semântica:** `<button>`/`<a>` para ações/links; headings em ordem (h1→h2→h3).
- [ ] **ARIA:** `role`/`aria-*` em modais, listbox, live regions — só quando o HTML nativo não chega.
- [ ] **Imagens:** `alt` descritivo ou `alt=""` se decorativa; ícones-botão com `aria-label`.
- [ ] **Contraste:** texto normal ≥4.5:1, grande ≥3:1 (testar nos dois temas).
- [ ] **Movimento:** respeitar `prefers-reduced-motion`.
- [ ] **Formulários:** `<label>` associado, `inputmode`/`type` corretos, erros descritivos e anunciados.
- [ ] **Estados:** loading (skeleton), vazio (mensagem + ação), erro (recuperável), sucesso (confirmação).
- [ ] **Responsivo:** sem overflow horizontal; `safe-area-inset`; teclado não tapa inputs.
- [ ] **Toque iOS:** inputs ≥16px para evitar zoom.

### Normas de apoio
- WCAG 2.1 AA — https://www.w3.org/WAI/WCAG21/quickref/
- Apple HIG (toque 44pt) — https://developer.apple.com/design/human-interface-guidelines
- Material Design (toque 48dp) — https://m3.material.io/foundations/accessible-design

---

*Auditoria gerada a partir do estado do código em 2026-06-22. Reavaliar após cada sprint.*
