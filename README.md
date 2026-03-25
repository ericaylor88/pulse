# Pulse

Personal health intelligence platform connecting wearables, body composition, genetics, and habits into actionable recommendations.

## Tech Stack

- **Frontend:** Next.js 16 + React 19 + shadcn/ui + Tailwind CSS v4 + Recharts
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions + RLS)
- **ML Compute:** FastAPI on Railway (Python: scikit-learn, pingouin, Prophet)
- **AI Insights:** Claude API (weekly briefs, NL queries)
- **Hosting:** Vercel

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Fill in your Supabase URL and anon key

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── auth/               # Login + OAuth callback
│   └── dashboard/
│       ├── overview/       # Daily Briefing (home)
│       ├── check-in/       # Daily habit logging
│       ├── trends/         # Time-series explorer
│       ├── body-comp/      # Weight/fat/muscle trends
│       ├── blood-work/     # Biomarker cards
│       ├── correlations/   # Correlation heatmap
│       ├── recommendations/# AI insights
│       ├── supplements/    # Supplement tracking
│       ├── illness-log/    # Illness events
│       ├── genetics/       # SNP profile
│       └── settings/       # Devices & preferences
├── components/             # shadcn/ui + custom components
├── config/                 # Navigation, app config
├── lib/
│   └── supabase/          # Client, server, middleware helpers
└── styles/                 # Tailwind + theme CSS
```

## Data Sources

- WHOOP (recovery, HRV, sleep, strain)
- Withings Body Comp (weight, body fat, muscle mass)
- Withings BPM Connect (blood pressure)
- BodySpec DEXA (quarterly body composition scans)
- Ancestry DNA (genetic profile)
- Open-Meteo (weather, AQI)
- Manual check-ins (habits, supplements, illness)

## License

Private — not open source.
