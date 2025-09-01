import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Play, Square, TrendingUp, TrendingDown, Activity, DollarSign, Target, Clock } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

const TradingDashboard = ({ socket }) => {
  // State management
  const [tradingStatus, setTradingStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [trades, setTrades] = useState([]);
  const [signals, setSignals] = useState([]);
  const [position, setPosition] = useState(null);
  const [latestPrice, setLatestPrice] = useState(null);
  const [livePosition, setLivePosition] = useState(null);
  const [pnlData, setPnlData] = useState([]);
  const [config, setConfig] = useState({
    symbol: 'BTCUSDT',
    brickSize: 50,
    emaLength: 21,
    atrPeriod: 1,
    defaultQuantity: 0.001
  });

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [statusRes, tradesRes, signalsRes, positionRes] = await Promise.all([
        axios.get(`${API_BASE}/trading/status`),
        axios.get(`${API_BASE}/trading/trades`),
        axios.get(`${API_BASE}/trading/signals`),
        axios.get(`${API_BASE}/trading/position`)
      ]);

      setTradingStatus(statusRes.data.data);
      setTrades(tradesRes.data.data || []);
      setSignals(signalsRes.data.data || []);
      setPosition(positionRes.data.data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setIsLoading(false);
    }
  };

  // Start trading
  const startTrading = async () => {
    try {
      await axios.post(`${API_BASE}/trading/start`, config);
      await fetchData();
    } catch (error) {
      console.error('Error starting trading:', error);
      alert('Failed to start trading: ' + error.message);
    }
  };

  // Stop trading
  const stopTrading = async () => {
    try {
      await axios.post(`${API_BASE}/trading/stop`);
      await fetchData();
    } catch (error) {
      console.error('Error stopping trading:', error);
    }
  };

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('tradingStatus', (data) => {
      setTradingStatus(data);
    });

    socket.on('positionEntered', (data) => {
      console.log('Position entered:', data);
      fetchData(); // Refresh all data
    });

    socket.on('positionExited', (data) => {
      console.log('Position exited:', data);
      fetchData(); // Refresh all data
      
      // Add to PnL data for chart
      setPnlData(prev => [...prev, {
        time: new Date().toLocaleTimeString(),
        pnl: data.pnl,
        cumulative: prev.reduce((sum, item) => sum + item.pnl, 0) + data.pnl
      }]);
    });

    socket.on('latestData', (data) => {
      setLatestPrice(data);
    });

    socket.on('dataProcessed', (data) => {
      if (data.newBricks > 0) {
        console.log(`New Renko bricks: ${data.newBricks}`);
      }
    });

    socket.on('pnlUpdated', (data) => {
      console.log('Live P&L updated:', data);
      setLivePosition(data.position);
      
      // Add to real-time P&L chart data
      setPnlData(prev => {
        const newData = [...prev];
        const now = new Date();
        newData.push({
          time: now.toLocaleTimeString(),
          timestamp: now.getTime(),
          unrealizedPnL: data.unrealizedPnL,
          percentage: data.pnlPercentage,
          price: data.currentPrice
        });
        // Keep only last 100 points for performance
        return newData.slice(-100);
      });
    });

    return () => {
      socket.off('tradingStatus');
      socket.off('positionEntered');
      socket.off('positionExited');
      socket.off('latestData');
      socket.off('dataProcessed');
      socket.off('pnlUpdated');
    };
  }, [socket]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading trading dashboard...</p>
      </div>
    );
  }

  const strategy = tradingStatus?.strategy;
  const isRunning = tradingStatus?.isRunning || false;
  const tradeStats = strategy?.tradeStats || {};

  return (
    <div className="trading-dashboard">
      {/* Control Panel */}
      <div className="control-panel">
        <div className="trading-controls">
          <h2>Trading Controls</h2>
          <div className="control-row">
            <div className="config-inputs">
              <input
                type="text"
                placeholder="Symbol"
                value={config.symbol}
                onChange={(e) => setConfig({...config, symbol: e.target.value})}
                disabled={isRunning}
              />
              <input
                type="number"
                placeholder="Brick Size"
                value={config.brickSize}
                onChange={(e) => setConfig({...config, brickSize: Number(e.target.value)})}
                disabled={isRunning}
              />
              <input
                type="number"
                placeholder="EMA Length"
                value={config.emaLength}
                onChange={(e) => setConfig({...config, emaLength: Number(e.target.value)})}
                disabled={isRunning}
              />
            </div>
            <div className="action-buttons">
              {!isRunning ? (
                <button className="start-btn" onClick={startTrading}>
                  <Play size={16} />
                  Start Trading
                </button>
              ) : (
                <button className="stop-btn" onClick={stopTrading}>
                  <Square size={16} />
                  Stop Trading
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="status-display">
          <div className={`status-badge ${isRunning ? 'running' : 'stopped'}`}>
            <Activity size={16} />
            {isRunning ? 'RUNNING' : 'STOPPED'}
          </div>
          {latestPrice && (
            <div className="price-display">
              <DollarSign size={16} />
              {config.symbol}: ${latestPrice.close?.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">
            <Target size={20} />
            <h3>Total Trades</h3>
          </div>
          <div className="stat-value">{tradeStats.totalTrades || 0}</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <TrendingUp size={20} />
            <h3>Win Rate</h3>
          </div>
          <div className="stat-value">{tradeStats.winRate || 0}%</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <DollarSign size={20} />
            <h3>Total PnL</h3>
          </div>
          <div className={`stat-value ${(tradeStats.totalPnL || 0) >= 0 ? 'positive' : 'negative'}`}>
            ${(tradeStats.totalPnL || 0).toFixed(4)}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <Activity size={20} />
            <h3>Renko Bricks</h3>
          </div>
          <div className="stat-value">{strategy?.renkoBricks || 0}</div>
        </div>

        {livePosition?.isActive && (
          <div className="stat-card">
            <div className="stat-header">
              <TrendingUp size={20} />
              <h3>Live P&L</h3>
            </div>
            <div className={`stat-value ${(livePosition.unrealizedPnL || 0) >= 0 ? 'positive' : 'negative'}`}>
              {livePosition.unrealizedPnL >= 0 ? '+' : ''}${(livePosition.unrealizedPnL || 0).toFixed(4)}
            </div>
            <div style={{ fontSize: '0.9rem', marginTop: '0.5rem', opacity: 0.8 }}>
              ({livePosition.pnlPercentage >= 0 ? '+' : ''}{(livePosition.pnlPercentage || 0).toFixed(2)}%)
            </div>
          </div>
        )}
      </div>

      {/* Current Position with Live P&L */}
      {(livePosition?.isActive || (position && position.isActive)) && (
        <div className="position-card">
          <h3>Current Position - Live P&L</h3>
          <div className="position-details">
            <span className={`position-side ${(livePosition || position).type}`}>
              {(livePosition || position).type?.toUpperCase()}
            </span>
            <span>Entry: ${(livePosition || position).entryPrice?.toFixed(2)}</span>
            <span>Current: ${livePosition?.currentPrice?.toFixed(2) || latestPrice?.close?.toFixed(2) || 'N/A'}</span>
            <span>Quantity: {(livePosition || position).quantity}</span>
            <span className="position-time">
              <Clock size={14} />
              {(livePosition || position).entryTime ? new Date((livePosition || position).entryTime).toLocaleTimeString() : 'N/A'}
            </span>
          </div>
          
          {/* Live P&L Display */}
          {livePosition && (
            <div className="live-pnl">
              <div className="pnl-row">
                <span>Unrealized P&L:</span>
                <span className={`pnl-value ${livePosition.unrealizedPnL >= 0 ? 'positive' : 'negative'}`}>
                  {livePosition.unrealizedPnL >= 0 ? '+' : ''}${livePosition.unrealizedPnL?.toFixed(4)}
                </span>
              </div>
              <div className="pnl-row">
                <span>Return:</span>
                <span className={`pnl-value ${livePosition.pnlPercentage >= 0 ? 'positive' : 'negative'}`}>
                  {livePosition.pnlPercentage >= 0 ? '+' : ''}{livePosition.pnlPercentage?.toFixed(2)}%
                </span>
              </div>
              <div className="pnl-row">
                <span>Duration:</span>
                <span>{livePosition.durationMinutes || 0} minutes</span>
              </div>
              <div className="pnl-status">
                <span className={`status-indicator ${livePosition.unrealizedPnL > 0 ? 'profit' : livePosition.unrealizedPnL < 0 ? 'loss' : 'breakeven'}`}>
                  {livePosition.unrealizedPnL > 0 ? '🟢 PROFIT' : livePosition.unrealizedPnL < 0 ? '🔴 LOSS' : '🟡 BREAKEVEN'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts Section */}
      <div className="charts-section">
        {pnlData.length > 0 && (
          <div className="chart-container">
            <h3>Live P&L Chart</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={pnlData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'unrealizedPnL' ? `$${value?.toFixed(4)}` : 
                    name === 'percentage' ? `${value?.toFixed(2)}%` : 
                    `$${value?.toFixed(2)}`, 
                    name === 'unrealizedPnL' ? 'P&L ($)' :
                    name === 'percentage' ? 'Return (%)' : 'Price ($)'
                  ]}
                  labelFormatter={(label) => `Time: ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="unrealizedPnL" 
                  stroke="#8884d8" 
                  name="Unrealized P&L" 
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="percentage" 
                  stroke="#82ca9d" 
                  name="Return %" 
                  strokeWidth={2}
                  yAxisId="right"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {trades.length > 0 && (
          <div className="chart-container">
            <h3>Recent Trades</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trades.slice(-10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" tickFormatter={(time) => new Date(time).toLocaleTimeString()} />
                <YAxis />
                <Tooltip 
                  labelFormatter={(time) => new Date(time).toLocaleString()}
                  formatter={(value, name) => [value?.toFixed(4), name]}
                />
                <Legend />
                <Bar dataKey="pnl" fill={(entry) => entry.pnl >= 0 ? "#10b981" : "#ef4444"} name="PnL" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Trade History Table */}
      {trades.length > 0 && (
        <div className="trades-table-container">
          <h3>Trade History</h3>
          <div className="trades-table">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Side</th>
                  <th>Type</th>
                  <th>Price</th>
                  <th>Quantity</th>
                  <th>PnL</th>
                </tr>
              </thead>
              <tbody>
                {trades.slice(-20).reverse().map((trade, index) => (
                  <tr key={trade.id || index}>
                    <td>{new Date(trade.timestamp).toLocaleTimeString()}</td>
                    <td className={`trade-side ${trade.side}`}>{trade.side.toUpperCase()}</td>
                    <td>{trade.type}</td>
                    <td>${trade.price?.toFixed(2)}</td>
                    <td>{trade.quantity}</td>
                    <td className={`pnl ${trade.pnl >= 0 ? 'positive' : 'negative'}`}>
                      {trade.pnl ? `$${trade.pnl.toFixed(4)}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Strategy Info */}
      <div className="strategy-info">
        <h3>Strategy Configuration</h3>
        <div className="strategy-params">
          <div>Symbol: {strategy?.config?.symbol || 'N/A'}</div>
          <div>Brick Size: {strategy?.config?.brickSize || 'N/A'}</div>
          <div>EMA Length: {strategy?.config?.emaLength || 'N/A'}</div>
          <div>SuperTrend Multipliers: {strategy?.config?.supertrendMultipliers?.join(', ') || 'N/A'}</div>
        </div>
      </div>
    </div>
  );
};

export default TradingDashboard;