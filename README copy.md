# NIFTY Algo Trading System

A production-grade algorithmic trading system for NIFTY options on Indian markets, built for Angel One (SmartAPI) broker. The system detects swing and divergence patterns in real time, executes options trades with Greeks-based risk management, and exposes a live Next.js dashboard for monitoring.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Trading Strategies](#trading-strategies)
- [Risk Management](#risk-management)
- [Backend](#backend)
- [Frontend](#frontend)
- [Database](#database)
- [GCP Deployment](#gcp-deployment)
- [Configuration & Environment](#configuration--environment)
- [Requirements](#requirements)
- [Getting Started](#getting-started)

---

## Project Overview

| Property | Detail |
|---|---|
| Market | NSE — NIFTY Index Options |
| Broker | Angel One (SmartAPI) |
| Instrument | NIFTY CE / PE options |
| Trading Hours | 09:15 – 15:30 IST |
| Strategy Types | Swing breakout, RSI Divergence |
| Risk per Trade | ₹800 – ₹900 (configurable) |
| Default Lot Size | 75 (NIFTY) |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Angel One SmartAPI                │
│           (WebSocket tick feed + REST orders)       │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│              Python Backend (FastAPI)               │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────┐ │
│  │ TradingEngine│  │  Strategies   │  │  Broker  │ │
│  │  (core/      │  │  (swing /     │  │  Layer   │ │
│  │  engine.py)  │  │  divergence)  │  │(angelone)│ │
│  └──────┬───────┘  └───────────────┘  └──────────┘ │
│         │  REST + WebSocket API (/api/*)            │
└─────────┼───────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────┐
│           PostgreSQL (algo_trading DB)              │
│  ticks │ orders │ trades │ excursions │ signals     │
└─────────────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────┐
│           Next.js 14 Dashboard (TypeScript)         │
│  Dashboard │ P&L │ Trades │ Orders │ Live Charts    │
└─────────────────────────────────────────────────────┘
```

---

## Trading Strategies

All strategies run on **5-minute NIFTY candles** built from real-time WebSocket ticks. Entry is confirmed on candle close; order placement uses bracket orders (BO) on Angel One NFO.

---

### 1. Bullish Swing

Detects a 5-point swing structure (L1 → H1 → A → B → C → D) and enters long on a breakout above the D-point.

#### Structure Points

```
L1  → First pivot low (9:15 candle low)
H1  → First swing high after L1
A   → Retracement high after H1
B   → New swing low (lowest point between L1 and A)
C   → Retracement high after B
D   → Highest high between B and C candles (breakout level)
```

#### Entry Conditions
- All 5 points (L1, H1, A, B, C, D) must be fully formed
- Price closes **above D + 0.05** on a 5-minute candle
- Structure not invalidated (spot has not broken below B)

#### Stop Loss
- **Point-based:** C − 0.05 (below the C candle low)
- **Greeks-enhanced (applied to CE option premium):**

```
Option SL = Delta × underlying_move
           + 0.5 × Gamma × underlying_move²
           + |Theta| / (24 × 6) × (10/60)
```

#### Target
- Risk:Reward = **1:2** (configurable)
- `Target = Entry + 2 × (Entry − SL)`

---

### 2. Bearish Swing

Mirror of Bullish Swing using a descending 5-point structure; enters short via PE options on a breakdown below D.

#### Structure Points

```
H1  → First pivot high (9:15 candle high)
L1  → First swing low after H1
A   → Retracement low after L1
B   → New swing high (highest between H1 and A)
C   → Retracement low after B
D   → Lowest low between B and C candles (breakdown level)
```

#### Entry Conditions
- All points formed
- Price closes **below D − 0.05**
- Structure not invalidated (spot has not broken above B)

#### Stop Loss
- **Point-based:** C + 0.05 (above the C candle high)
- **Greeks-enhanced:** Same formula applied to PE option premium

#### Target
- `Target = Entry − 2 × (SL − Entry)`

---

### 3. Bullish Divergence

Detects a timing divergence between NIFTY **spot** and **futures** pivot lows, then enters long when price breaks above a confirming red candle high.

#### Detection Logic
1. **Pivot Low (L1):** `candidate_low < prev_low AND candidate_low < next_low` on 5-minute candles
2. **Divergence:** Futures breaks the same pivot level **≥ 30 seconds** before or after spot (threshold = 0.5 min)
3. **Red Candle:** First candle after L1 where `close < open` AND `high ≥ previous candle high`

#### Entry Conditions
- Divergence window active (spot/futures timing divergence detected)
- L1 pivot low confirmed
- Red candle identified post-L1
- Price breaks **above red candle high** on 1-minute close

#### Stop Loss
- Red candle low (hard stop)
- If price falls below L1 → setup invalidated, re-scan begins

#### Target
- `Target = Entry + 2 × (Entry − Red_Candle_Low)`

#### Timeouts
| Timer | Duration |
|---|---|
| Entry setup | 5 minutes |
| Red candle window | 3 minutes |
| Pullback window | 3 minutes |

---

### 4. Bearish Divergence

Mirror of Bullish Divergence using pivot **highs** and a confirming **green candle** for PE option entry.

#### Detection Logic
1. **Pivot High (H1):** `candidate_high > prev_high AND candidate_high > next_high`
2. **Divergence:** Spot/futures timing divergence on the same pivot high
3. **Green Candle:** `close > open` AND `low ≤ previous candle low` after H1

#### Entry Conditions
- Divergence window active
- H1 pivot high confirmed
- Green candle found post-H1
- Price breaks **below green candle low**

#### Stop Loss
- Green candle high (hard stop)
- If price rises above H1 → setup invalidated

#### Target
- `Target = Entry − 2 × (Green_Candle_High − Entry)`

---

### Strike Selection

Strikes are selected at signal time from a pre-fetched Greeks cache to avoid API latency.

| Expiry | CE/PE Type | Count |
|---|---|---|
| Current week | 1 OTM + 1 ATM + 4 ITM | 6 strikes |
| Next week | 1 OTM + 1 ATM + 3 ITM | 5 strikes |

The strike whose risk amount is **closest to ₹5,250** (the target risk mid-point) is selected.

---

## Risk Management

### Position Sizing

| Parameter | Value |
|---|---|
| Target risk per trade | ₹5,250 (range ₹5,000–₹5,500) |
| NIFTY lot size | 75 contracts |
| Max lots per trade | 50 (3,750 contracts max) |
| Risk:Reward ratio | 1:2 |
| Max open positions | 3 simultaneous trades |

**Algorithm:**
```
for lots in range(1, MAX_LOTS + 1):
    risk = (sl_points × lot_size × lots)
    if TARGET_RISK_MIN ≤ risk ≤ TARGET_RISK_MAX:
        best_lots = lots  # closest to ₹5,250 mid-point
quantity = best_lots × 75
```

### Greeks-Based Stop Loss

Greeks are fetched from Angel One's option chain API and cached every **10 seconds**. At signal time, the cached values are used immediately (no API call delay).

| Greek | Role |
|---|---|
| **Delta** | Primary SL component — option sensitivity to spot move |
| **Gamma** | Convexity adjustment — second-order price change |
| **Theta** | Time decay — estimated 10-minute decay impact deducted |
| **Vega** | Volatility sensitivity — logged but not used in core SL |
| **IV** | Implied Volatility — logged for moneyness classification |

**Greeks rate limits enforced:**

| Limit | Value |
|---|---|
| Daily | 3,000 calls |
| Per minute | 180 calls |
| Per expiry/minute | 90 calls |
| Per second | 3 calls |

### Order Execution

- **Order type:** Bracket Order (BO) — includes SL and target in a single order
- **Exchange:** NFO (National Futures & Options)
- **Product:** INTRADAY (auto-squared off at market close)
- **Duration:** DAY

**API rate limits enforced:**

| Limit | Value |
|---|---|
| Per minute | 500 requests |
| Per second | 20 requests (50 ms min interval) |
| Status polls | 10/sec (100 ms min interval) |

### Excursion Tracking (Post-Entry)

Every open trade is tracked tick-by-tick via WebSocket subscription to the option token.

| Metric | Formula (CE/bullish) |
|---|---|
| MFE (Max Favourable Excursion) | `max(0, spot_price − entry)` |
| MAE (Max Adverse Excursion) | `max(0, entry − spot_price)` |
| R:R Achieved | `MFE / initial_risk` |
| Positive flag | Triggered when R:R ≥ 4.0 |

**Exit triggers (checked every tick):**
- Option price ≤ SL → `OPTION_SL_HIT` → close trade
- Option price ≥ Target → `OPTION_TARGET_HIT` → close trade
- 15:30 IST → `MARKET_CLOSE` → square off all open positions

### Trade Lifecycle

```
Signal Generated
      │
      ▼
Pre-create trade (VIRTUAL/PENDING) in DB
      │
      ▼
Place Bracket Order via Angel One API
      │
      ├─ SUCCESS → Update trade to FILLED/REAL
      │            Subscribe option token to WebSocket
      │            Begin excursion tracking
      │
      └─ FAILURE → Mark REJECTED, log error, retry with backoff
                   (signal deduplication prevents double-entry)
```

### Signal Deduplication

- Each strategy tracks its current D-point (swing) or red/green candle level (divergence)
- `order_attempted` flag set on first order for a given setup
- Flag resets only when D-point changes (new structure detected)
- Prevents re-entering the same trade on the same signal

---

## Backend

**Directory:** `IndianMarket-Algo-Trading/`

**Language / Framework:** Python 3.11 + FastAPI + Uvicorn

### Directory Structure

```
IndianMarket-Algo-Trading/
├── main.py                     # Entry point
├── config/
│   └── settings.py             # 150+ env-driven config params
├── core/
│   ├── engine.py               # Main trading engine loop
│   ├── feed_handler.py         # WebSocket tick processing
│   └── router.py               # Signal routing & order execution
├── brokers/
│   └── angelone.py             # Angel One SmartAPI wrapper
├── api/
│   ├── server.py               # FastAPI app (REST + WebSocket)
│   ├── state.py                # Shared in-memory state
│   └── run_standalone.py       # Standalone launcher
├── strategies/
│   ├── bullish_swing.py        # Bullish breakout strategy
│   ├── bearish_swing.py        # Bearish breakout strategy
│   ├── bullish_divergence.py   # RSI bullish divergence
│   └── bearish_divergence.py   # RSI bearish divergence
├── models/
│   ├── option.py               # Option data model
│   ├── order_manager.py        # Order lifecycle manager
│   └── trade_tracker.py        # P&L tracking
├── db/
│   ├── schema.py               # PostgreSQL schema & migrations
│   ├── pool.py                 # Connection pooling (psycopg2)
│   ├── migrate.py              # Migration runner
│   ├── tick_buffer.py          # In-memory tick buffer
│   ├── purge_ticks.py          # Old partition cleanup
│   ├── validate.py             # Schema validation
│   └── repositories/           # Data access layer
│       ├── order_repo.py
│       ├── trade_repo.py
│       ├── entry_repo.py
│       ├── excursion_repo.py
│       ├── tick_repo.py
│       └── signal_repo.py
├── data/
│   ├── ohlcv.py                # OHLCV candle construction
│   └── futures.py              # Futures token/price helpers
├── utils/
│   ├── logger.py               # logzero-based structured logger
│   ├── helpers.py              # General utilities
│   ├── live_capture.py         # Live tick capture
│   └── retry.py                # Exponential-backoff retry
├── requirements.txt
├── setup_env.py                # Interactive .env setup wizard
└── .env.example
```

### Key Python Dependencies

| Package | Version | Purpose |
|---|---|---|
| `fastapi` | latest | REST API & WebSocket server |
| `uvicorn[standard]` | latest | ASGI server |
| `smartapi-python` | 1.4.8 | Angel One broker API |
| `websocket-client` | 1.8.0 | Broker WebSocket tick feed |
| `psycopg2-binary` | 2.9.9 | PostgreSQL driver |
| `pandas` | latest | OHLCV candle calculations |
| `numpy` | latest | Numerical signal processing |
| `pyotp` | 2.8.0 | TOTP 2FA for broker login |
| `python-dotenv` | 1.0.0 | Environment variable loading |
| `logzero` | 1.7.0 | Structured rotating logs |
| `autobahn` | 24.4.2 | WebSocket protocol support |
| `cryptography` | 43.0.1 | Secure credential handling |
| `requests` | 2.31.0 | REST API calls |
| `matplotlib` | latest | Optional chart generation |

### REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/status` | Bot status, uptime, kill switch state |
| GET | `/api/prices` | Spot price, futures price, option premium |
| GET | `/api/strategies` | Active strategy states |
| GET | `/api/orders/today` | Today's orders (DB or CSV fallback) |
| WS | `/ws` | Real-time tick and signal stream |

### Additional Safeguards

- **Market hours guard:** Orders only placed 09:15–15:30 IST
- **Kill switch:** Soft stop via `/api/status` endpoint (no new orders placed)
- **Retry logic:** Exponential backoff on API failures (`utils/retry.py`)

See the [Risk Management](#risk-management) section above for full position sizing, Greeks SL, and excursion tracking details.

---

## Frontend

**Directory:** `Algo-Dashboard/`

**Framework:** Next.js 14.2.35 (App Router) + TypeScript + React 18

### Directory Structure

```
Algo-Dashboard/
├── src/
│   ├── app/
│   │   ├── page.tsx            # Main real-time dashboard
│   │   ├── layout.tsx          # Root layout
│   │   ├── pnl/page.tsx        # P&L analysis page
│   │   ├── trades/page.tsx     # Trade history view
│   │   └── orders/page.tsx     # Orders history view
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── DashboardGrid.tsx         # Responsive grid layout
│   │   │   ├── CandlestickChart.tsx      # Live OHLCV chart
│   │   │   ├── StrategyCards.tsx         # Per-strategy status cards
│   │   │   ├── StrategyPerformance.tsx   # Win rate, avg P&L
│   │   │   ├── RiskMetricsPanel.tsx      # Live risk exposure
│   │   │   ├── SystemControls.tsx        # Start/Stop/Kill switch UI
│   │   │   ├── EntrySignalsTable.tsx     # Signal history table
│   │   │   ├── SignalFeed.tsx            # Live signal stream
│   │   │   ├── ExposureCurve.tsx         # Capital exposure over time
│   │   │   ├── TradeExcursionPanel.tsx   # MFE/MAE visualisation
│   │   │   ├── TopBar.tsx                # Header with market status
│   │   │   └── widgets/
│   │   │       └── TradeStatsWidget.tsx  # Summary stat cards
│   │   └── MonthlyPnl.tsx               # Monthly P&L calendar
│   └── lib/
│       ├── api.ts              # Backend REST API client
│       └── websocket.ts        # WebSocket connection manager
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.mjs
```

### Frontend Dependencies

| Package | Version | Purpose |
|---|---|---|
| `next` | 14.2.35 | React SSR / App Router framework |
| `react` | ^18 | UI component library |
| `react-dom` | ^18 | DOM rendering |
| `lightweight-charts` | ^4.1.0 | TradingView-style candlestick charts |
| `react-grid-layout` | ^2.2.2 | Draggable, resizable dashboard grid |
| `tailwindcss` | ^3.4.1 | Utility-first CSS framework |
| `typescript` | ^5 | Static typing |
| `eslint` | ^8 | Code linting |

### Dashboard Pages

| Page | Route | Description |
|---|---|---|
| Main Dashboard | `/` | Live prices, strategy cards, candlestick chart, signal feed |
| P&L Analysis | `/pnl` | Cumulative P&L curve, monthly breakdown, trade analytics |
| Trades | `/trades` | Full trade history with entry/exit details |
| Orders | `/orders` | Raw order log with status tracking |

---

## Database

**Engine:** PostgreSQL
**Database name:** `algo_trading`
**User:** `algotrader`
**Port:** `5432`
**Connection pool:** 2–10 connections (psycopg2)

### Schema Tables

#### `ticks` (partitioned by date)
Stores every market tick received from the WebSocket feed.

| Column | Type | Description |
|---|---|---|
| `ts` | TIMESTAMPTZ | Tick timestamp (indexed DESC) |
| `instrument` | TEXT | `spot`, `fut`, or `opt` |
| `token` | TEXT | Angel One instrument token |
| `price` | NUMERIC | Last traded price |

- Partitioned by `YYYYMMDD` (daily partitions auto-created)
- Tomorrow's partition pre-created at startup to avoid runtime latency
- Purge script removes partitions older than retention window

#### `orders`
Individual order events (one row per API order call).

| Column | Type | Description |
|---|---|---|
| `order_id` | TEXT | Unique (Angel One order ID) |
| `trade_id` | UUID | FK → trades |
| `symbol` | TEXT | Instrument symbol |
| `side` | TEXT | BUY / SELL |
| `qty` | INTEGER | Quantity |
| `price` | NUMERIC | Execution price |
| `status` | TEXT | PENDING / COMPLETE / REJECTED |
| `created_at` | TIMESTAMPTZ | Timestamp |

#### `trades`
Logical trade lifecycle (entry → exit).

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `strategy` | TEXT | Strategy name |
| `direction` | TEXT | LONG / SHORT |
| `entry_price` | NUMERIC | Option premium at entry |
| `exit_price` | NUMERIC | Option premium at exit |
| `entry_time` | TIMESTAMPTZ | Entry timestamp |
| `exit_time` | TIMESTAMPTZ | Exit timestamp |
| `realized_pnl` | NUMERIC | Final P&L in ₹ |
| `status` | TEXT | OPEN / CLOSED / STOPPED |
| `tracking_mode` | TEXT | Greeks / Fixed SL mode |
| `execution_status` | TEXT | Filled / Partial |
| `max_rr_achieved` | NUMERIC | Best risk:reward reached |
| `mfe` | NUMERIC | Maximum Favourable Excursion |
| `mae` | NUMERIC | Maximum Adverse Excursion |

#### `entry_signals`
Snapshot of market context at each entry signal.

| Column | Type | Description |
|---|---|---|
| `signal_id` | UUID | Primary key |
| `strategy` | TEXT | Strategy name |
| `spot_price` | NUMERIC | NIFTY spot at signal time |
| `futures_price` | NUMERIC | NIFTY futures price |
| `vix` | NUMERIC | India VIX |
| `strike_distance` | NUMERIC | Distance from ATM strike |
| `premium` | NUMERIC | Option premium |
| `timeframe` | TEXT | Candle timeframe used |
| `signal_time` | TIMESTAMPTZ | When signal was generated |

#### `excursions`
Detailed MFE/MAE tracking per trade (updated tick-by-tick while trade is open).

| Column | Type | Description |
|---|---|---|
| `trade_id` | UUID | FK → trades |
| `spot_entry` | NUMERIC | Spot price at entry |
| `spot_sl` | NUMERIC | Spot stop loss level |
| `spot_target` | NUMERIC | Spot target level |
| `opt_entry` | NUMERIC | Option entry premium |
| `opt_sl` | NUMERIC | Option SL premium |
| `opt_target` | NUMERIC | Option target premium |
| `mfe` | NUMERIC | Best unrealised profit |
| `mae` | NUMERIC | Worst unrealised loss |
| `rr_achieved` | NUMERIC | R:R ratio at best point |

#### `signal_history`
Append-only log of every signal fired (for backtesting / audit).

#### `schema_migrations`
Tracks applied migration versions.

### Database Indexes (16+)

- `ticks`: `ts DESC`, `date`, `instrument`
- `orders`: `trade_id`, `status`, `created_at DESC`
- `trades`: `strategy`, `status`, `entry_time DESC`
- `excursions`: `trade_id`
- `entry_signals`: `strategy`, `signal_time DESC`

---

## GCP Deployment

The system is designed to run on **Google Cloud Platform** with the following recommended setup:

### Recommended GCP Services

| Service | Purpose |
|---|---|
| **Compute Engine** (e2-standard-2) | Host Python backend + FastAPI server |
| **Cloud SQL (PostgreSQL 15)** | Managed PostgreSQL with auto-backups |
| **Cloud Storage** | CSV export storage, log archival |
| **Cloud Logging** | Centralised log ingestion from `logzero` |
| **Cloud Monitoring** | Alerting on P&L drawdown, API errors |
| **Secret Manager** | Store broker credentials (API key, TOTP, password) |
| **VPC / Firewall** | Restrict dashboard port (3000) and API port (8000) |

### Deployment Notes

- Backend runs as a **systemd service** on the VM for auto-restart
- Frontend is served via **Next.js standalone build** or deployed to **Vercel**
- Environment variables sourced from **Secret Manager** at VM startup
- PostgreSQL connection string injected via env (not hardcoded)
- CORS configured to allow dashboard origin only (not `*` in production)

### Recommended VM Startup Script

```bash
# Pull latest code
cd /opt/trading && git pull

# Activate venv & start backend
source .venv/bin/activate
python main.py &

# Start dashboard
cd Algo-Dashboard && npm run start
```

---

## Configuration & Environment

All configuration is driven by environment variables, loaded via `python-dotenv`.

### Required Variables

| Variable | Example | Description |
|---|---|---|
| `ANGEL_API_KEY` | `zCjdRuaC` | Angel One API key |
| `ANGEL_USERNAME` | `A1389496` | Angel One client ID |
| `ANGEL_PASSWORD` | `2026` | Angel One password |
| `ANGEL_TOTP_KEY` | `EGT7K2YIJUMQFL3L4PP...` | TOTP secret for 2FA |
| `SPOT_TOKEN` | `99926000` | Angel One token for NIFTY spot |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `algo_trading` | Database name |
| `DB_USER` | `algotrader` | Database user |
| `DB_PASSWORD` | `your_password` | Database password |

### Optional Variables

| Variable | Default | Description |
|---|---|---|
| `DEFAULT_LOT_SIZE` | `75` | NIFTY lot size |
| `DEFAULT_MAX_RISK` | `1000` | Max risk per trade (₹) |
| `DEFAULT_ACCOUNT_BALANCE` | `100000` | Account capital for sizing |
| `TARGET_RISK_MIN` | `800` | Minimum target risk (₹) |
| `TARGET_RISK_MAX` | `900` | Maximum target risk (₹) |
| `MAX_REQUESTS_PER_MINUTE` | `500` | Angel One API rate limit |
| `MARKET_OPEN_HOUR` | `9` | Market open hour (IST) |
| `MARKET_OPEN_MINUTE` | `15` | Market open minute |
| `MARKET_CLOSE_HOUR` | `15` | Market close hour (IST) |
| `MARKET_CLOSE_MINUTE` | `30` | Market close minute |
| `LOG_LEVEL` | `INFO` | Logging verbosity |

Run `python setup_env.py` for an interactive setup wizard.

---

## Requirements

### System Requirements

| Requirement | Minimum | Recommended |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB SSD | 50 GB SSD |
| OS | Ubuntu 22.04 | Ubuntu 22.04 LTS |
| Python | 3.11 | 3.11 |
| Node.js | 18.x | 20.x LTS |
| PostgreSQL | 14 | 15 |

### Network Requirements

- Stable internet (low latency to NSE preferred)
- Outbound access to `smartapi.angelbroking.com`
- Port `8000` open for API (internal or load-balanced)
- Port `3000` open for dashboard (restrict to trusted IPs)

### Broker Requirements

- Active **Angel One** trading account
- **SmartAPI** access enabled (apply via Angel One portal)
- **TOTP authenticator** set up for API login
- Sufficient **margin/funds** for NIFTY options trading

---

## Getting Started

### 1. Clone the repositories

```bash
git clone <backend-repo-url> IndianMarket-Algo-Trading
git clone <frontend-repo-url> Algo-Dashboard
```

### 2. Set up the backend

```bash
cd IndianMarket-Algo-Trading
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python setup_env.py      # interactive .env setup
```

### 3. Set up PostgreSQL

```bash
sudo -u postgres psql
CREATE USER algotrader WITH PASSWORD 'your_password';
CREATE DATABASE algo_trading OWNER algotrader;
\q

# Run migrations
python db/migrate.py
```

### 4. Start the backend

```bash
python main.py
# API available at http://localhost:8000
```

### 5. Set up and start the frontend

```bash
cd ../Algo-Dashboard
npm install
# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
# Dashboard available at http://localhost:3000
```

---

## Author

**Abhishek Choudhary**
AI/ML Developer
GitHub: [@abhishekcloudhary1710](https://github.com/abhishekcloudhary1710)
Email: abhishekchoudhary2417@gmail.com

---

*Built for live trading on NSE. Use at your own risk. Always test in paper trading mode before deploying with real capital.*
