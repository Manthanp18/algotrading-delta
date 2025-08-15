# Trading Dashboard

A comprehensive Next.js dashboard for monitoring cryptocurrency trading activities, built specifically for the AlgoMCP backtesting engine.

## 🚀 Features

### 📊 Live Positions
- Real-time portfolio tracking
- Current position details with unrealized P&L
- Position-level analytics
- Live price monitoring
- Session uptime and performance metrics

### 📈 Trade History
- Complete trading history with full details
- Advanced filtering by date, status, and trade type
- Real-time trade updates
- Detailed entry/exit information
- P&L analysis per trade

### 📉 Analytics Dashboard
- Comprehensive performance metrics
- Win rate and profit factor analysis
- Cumulative P&L charts
- Hourly performance breakdown
- Long vs Short trade statistics
- Best/worst trade tracking

## 🛠️ Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- The main AlgoMCP trading system running (for live data)

### Quick Start

1. **Clone and install dependencies:**
   ```bash
   cd trading-dashboard
   npm install
   ```

2. **Start the dashboard:**
   ```bash
   ./start-dashboard.sh
   ```
   
   Or manually:
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📡 API Endpoints

The dashboard includes several API endpoints for data retrieval:

### `/api/session`
Returns current live trading session data including:
- Portfolio equity and cash
- Open positions
- Real-time metrics
- Session uptime

### `/api/trades?date=YYYY-MM-DD`
Returns trading history for a specific date:
- All trades with full details
- Entry/exit prices and times
- P&L calculations
- Trade reasons and signals

### `/api/analytics?date=YYYY-MM-DD`
Returns comprehensive analytics for a date:
- Performance metrics
- Win/loss statistics
- Hourly breakdown
- Cumulative P&L data

## 🔧 Configuration

### Data Sources
The dashboard automatically reads from the main project's data files:
- `../dashboard/trades/current_session.json` - Live session data
- `../dashboard/trades/trades_YYYY-MM-DD.json` - Historical trades

### Environment Setup
No additional environment variables needed. The dashboard automatically connects to the file-based data from the main trading system.

## 🏗️ Developer-Friendly Architecture

### Clean Project Structure
```
src/
├── components/           # Organized by feature
│   ├── ui/              # Reusable UI components
│   ├── trades/          # Trade-related components
│   ├── positions/       # Position components
│   └── analytics/       # Analytics components
├── hooks/               # Custom React hooks
├── types/               # TypeScript definitions
├── utils/               # Utility functions
├── lib/                 # Shared libraries
└── config/              # Configuration
```

### Key Features
- **Type Safety**: Full TypeScript implementation
- **Custom Hooks**: Clean data fetching with `useTrades`, `useSession`, `useAnalytics`
- **Error Handling**: Comprehensive error states and loading skeletons
- **Reusable Components**: Modular UI components for cards, filters, and states
- **Performance**: Optimized with React.memo, useCallback, and code splitting

## 🎨 Design System

- **Dark Theme**: Optimized for trading environments
- **Responsive**: Works on desktop and mobile devices  
- **Real-time**: Auto-refreshing data every 30 seconds
- **Interactive**: Hover states and smooth transitions

## 🔄 Real-time Updates

The dashboard automatically refreshes data:
- Session data: Every 30 seconds
- Trade history: On date change
- Analytics: On demand
- Charts: Real-time updates

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm run start
```

### Docker (Optional)
```bash
# From the trading-dashboard directory
docker build -t trading-dashboard .
docker run -p 3000:3000 trading-dashboard
```

## 📊 Performance

- **Optimized**: Built with Next.js 15 and React 19
- **Fast**: Client-side routing and data caching
- **Efficient**: Incremental data loading
- **Responsive**: Sub-second page transitions

## 🔐 Security

- **Local Data**: No external API keys required
- **File-based**: Reads from local JSON files
- **No Auth**: Designed for local development use
- **Safe**: No write operations to trading data

## 🐛 Troubleshooting

### Common Issues

**Dashboard shows "No Active Session":**
- Ensure the main trading system is running
- Check that `../dashboard/trades/current_session.json` exists

**No trades showing:**
- Verify trade files exist in `../dashboard/trades/`
- Check the selected date has trading activity
- Ensure file permissions allow reading

**API errors:**
- Restart the dashboard server
- Check console logs for specific error messages
- Verify the parent directory structure

### Debug Mode
```bash
# Enable verbose logging
DEBUG=true npm run dev
```

## 📈 Usage Examples

### Monitoring Live Trading
1. Start your live trading system
2. Open the dashboard at localhost:3000
3. Navigate to "Live Positions" tab
4. Monitor real-time P&L and positions

### Analyzing Performance
1. Go to "Analytics" tab  
2. Select date range
3. Review win rate and profit metrics
4. Analyze hourly performance patterns

### Reviewing Trades
1. Click "Trade History" tab
2. Filter by trade type (Long/Short)
3. Sort by P&L to find best/worst trades
4. Export data for further analysis

## 🤝 Contributing

To contribute to the dashboard:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the main project LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the main project documentation
3. Open an issue in the main repository

---

**Note**: This dashboard is designed to work with the AlgoMCP backtesting and live trading system. Make sure the main system is properly configured and running for full functionality.
