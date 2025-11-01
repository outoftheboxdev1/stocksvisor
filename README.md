![Logo](https://i.imgur.com/mRVGhg9.png)

# ⚡ StocksVisor

![Dashboard Overview](https://i.imgur.com/dpwKSJ3.png)

> **Your Smart Investment Companion** — Track stocks, get AI-powered insights, and receive real-time alerts tailored to your watchlist.  
> *Stay ahead of the markets with precision.*

---

## 🌐 Overview

**StocksVisor** is an intelligent stock-tracking platform that helps you monitor your favorite companies, receive instant price alerts, and stay updated with summarized market news — all in one sleek interface.  
Whether you're a casual trader or a data-driven investor, StocksVisor makes it effortless to make informed decisions.

---

## 🚀 Core Features

### 💼 Personalized Watchlist
![Watchlist View](https://i.imgur.com/L4ZbdAL.png)
- Add and manage multiple stocks effortlessly.
- View live price, percentage change, market cap, and P/E ratio.
- One-click star icons toggle watchlist items dynamically across the app.

---

### 🔔 Smart Price Alerts
![Price Alert Example](https://i.imgur.com/ICIrUfh.png)
- Set custom price thresholds for any stock.
- Receive **instant email notifications** when your target price is reached.
- Each alert includes **contextual insights** — when to hold, take profits, or reassess.
- Manage all active alerts from your watchlist in real time.
![Price Alert Example](https://i.imgur.com/igUtliW.png)
---

### 📰 AI-Summarized Market News
![Market News Summary](https://i.imgur.com/9tZo6Xj.png)
- Get daily curated stock news powered by **Google Gemini AI**.
- Personalized summaries based on your watchlist, or global market overviews if you have none.
- Helps you digest complex news into actionable intelligence.

---

### 📈 In-Depth Stock Analysis
![Stock Detail View](https://i.imgur.com/TKW7R9v.png)
- Live price charts and technical analysis powered by **TradingView**.
- Buy/Sell/Neutral indicators for multiple timeframes.
- Company fundamentals, valuation metrics, and financial performance — all in one place.

---

### 🌍 Interactive Market Dashboard
![Dashboard Heatmap](https://i.imgur.com/NjRCSsh.png)
- A beautiful **sector-based heatmap** of the stock market.
- Instantly visualize which industries are heating up or cooling down.
- Real-time data fetched directly from **Finnhub APIs**.

---

### 👤 User Profiles & Preferences
![Profile Page](https://i.imgur.com/6VpPhdY.png)
- Simple and secure **email sign-up** with **Better Auth**.
- Customize your name and profile picture.
- Enable or disable daily AI-curated news emails anytime.

---

## 🧠 How It Works

1. **Sign up** securely with your email using Better Auth.
2. **Add your favorite stocks** to your personal watchlist.
3. **Set alert thresholds** — for example, “Notify me if TSLA drops 5%.”
4. **Get notified instantly** via email when a price crosses your target.
5. **Read daily AI-summarized market news** tailored to your interests.

> 📩 StocksVisor isn’t just a tracker — it’s your personal investment assistant.

---

## 🧩 Tech Stack

| Layer | Technology |
|:------|:------------|
| **Frontend** | Next.js • React • TailwindCSS • TypeScript |
| **Backend** | Node.js • Express • Mongoose • MongoDB |
| **Auth** | Better Auth (email-based authentication) |
| **Market Data APIs** | Finnhub • TradingView |
| **AI Summaries** | Google Gemini API |
| **Notifications** | Nodemailer • Cron Jobs |
| **Hosting** | Vercel (Frontend) • Render / Railway (Backend) |

---

## ⚙️ Installation

```bash
# Clone the repository
git clone https://github.com/outoftheboxdev1/stocksvisor.git

# Enter the project directory
cd stocksvisor

# Install dependencies
npm install

# Configure environment variables
# (See .env.example for required API keys and configuration)
# Example:
# FINNHUB_API_KEY=your_finnhub_key
# GEMINI_API_KEY=your_gemini_key
# MONGODB_URI=your_connection_string

# Run development server
npm run dev
