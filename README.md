# FIFA World Cup 2026

Mobile-first web app for the FIFA World Cup 2026 (USA, Canada & Mexico). Browse the full tournament schedule, follow your favourite teams, run a betting pool with friends, and track live scores.

**[Open the app →](https://martinsmdnuno.github.io/wc26/)** &nbsp;·&nbsp; **[View the landing page →](https://martinsmdnuno.github.io/wc26/landing.html)**

<p align="center">
  <img src="designs/calend_rio_main_screen/screen.png" alt="Schedule" width="22%" />
  <img src="designs/selecione_sua_equipa_onboarding/screen.png" alt="Onboarding" width="22%" />
  <img src="designs/minha_equipa_brasil/screen.png" alt="My team" width="22%" />
  <img src="designs/tabela_eliminar_rias/screen.png" alt="Standings" width="22%" />
</p>

## Features

- **Schedule** — All 104 matches across 7 phases, with venues and kick-off times (BST)
- **Teams** — 48 qualified teams browsable A-Z, by group, or by confederation
- **Favourites** — Star teams to filter their matches in "My Matches"
- **Calendar export** — Add single or bulk matches to your device calendar (ICS)
- **Betting pool** — Predict match scores and compete with friends in a private group
- **Leaderboard** — Live ranking with points (5 exact / 3 outcome / 1 partial / 0 miss)
- **Live scores** — Automatic results via football-data.org API
- **Bilingual** — Full Portuguese (PT) and English (EN) support

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 |
| Build | Vite 8 |
| Styling | Vanilla CSS with custom properties |
| Auth | Firebase Anonymous Auth |
| Database | Cloud Firestore |
| Live scores | football-data.org API |
| Deploy | GitHub Pages (GitHub Actions) |

## Getting started

```bash
# Clone
git clone https://github.com/martinsmdnuno/wc26.git
cd wc26

# Install
npm install

# Configure Firebase — copy and fill in your credentials
cp .env.example .env

# Run
npm run dev
```

### Environment variables

| Variable | Description |
|----------|------------|
| `VITE_FIREBASE_API_KEY` | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_FOOTBALL_DATA_API_KEY` | football-data.org API key (free tier) |

## Project structure

```
src/
├── components/        # Reusable UI components
│   ├── BetCard.jsx        # Match card with score prediction inputs
│   ├── BottomNav.jsx      # Tab navigation bar
│   ├── HamburgerMenu.jsx  # Slide-out menu (profile, invite, rules)
│   ├── LanguageSwitcher.jsx
│   ├── Leaderboard.jsx    # Group ranking table
│   ├── MatchCard.jsx      # Match display card (schedule view)
│   ├── NicknameModal.jsx  # First-use onboarding modal
│   ├── PhaseFilter.jsx    # Phase selection chips
│   └── TeamCard.jsx       # Team card with favourite toggle
├── data/
│   ├── schedule.json      # All 104 matches with venues
│   └── confederations.js  # Team-to-confederation mapping
├── hooks/
│   ├── useAuth.jsx        # Firebase anonymous auth + profile
│   ├── useBets.js         # Bet CRUD + scoring
│   ├── useFavorites.js    # localStorage favourites
│   └── useLiveScores.js   # football-data.org polling
├── i18n/
│   ├── LanguageContext.jsx
│   └── translations.js   # PT-PT & EN-GB translations
├── pages/
│   ├── Bets.jsx           # Betting pool (predict + ranking)
│   ├── Missing.jsx        # Teams that didn't qualify
│   ├── MyMatches.jsx      # Filtered schedule for favourite teams
│   ├── Rules.jsx          # Pool scoring rules
│   ├── Schedule.jsx       # Full tournament schedule
│   └── Teams.jsx          # Team directory
├── utils/
│   ├── calendar.js        # ICS file generation
│   ├── footballApi.js     # football-data.org wrapper
│   └── scoring.js         # Points calculation (5/3/1/0)
├── firebase.js            # Firebase config & init
├── App.jsx
├── App.css
├── index.css
└── main.jsx
```

## Scoring rules

| Points | Condition | Example |
|--------|-----------|---------|
| **5** | Exact result | Predicted 2-1, result 2-1 |
| **3** | Correct outcome | Predicted 1-0, result 2-1 (home win) |
| **1** | One team's goals correct | Predicted 2-1, result 2-3 |
| **0** | Nothing correct | Predicted 0-0, result 2-1 |

Tiebreak: total points > exact results > correct outcomes.

## Screens

| Schedule | Onboarding | My team | Standings |
| :---: | :---: | :---: | :---: |
| ![Schedule](designs/calend_rio_main_screen/screen.png) | ![Onboarding](designs/selecione_sua_equipa_onboarding/screen.png) | ![My team](designs/minha_equipa_brasil/screen.png) | ![Standings](designs/tabela_eliminar_rias/screen.png) |

## Design system

Visual style is documented in [`designs/campeonato_prestige/DESIGN.md`](designs/campeonato_prestige/DESIGN.md) — a "championship prestige" theme with serif headings (Oswald), DM Sans body, dark green and gold accents.

## License

MIT
