import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import TradingDashboard from './components/TradingDashboard';
import './App.css'

function App() {
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  useEffect(() => {
    // Connect to backend
    const newSocket = io('http://localhost:3001', {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to backend');
      setConnectionStatus('connected');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from backend');
      setConnectionStatus('disconnected');
    });

    newSocket.on('status', (data) => {
      console.log('Backend status:', data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <div className="App">
      <header className="app-header">
        <h1>🚀 Delta Exchange Algo Trading Dashboard</h1>
        <div className={`connection-status ${connectionStatus}`}>
          <span className="status-dot"></span>
          {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
        </div>
      </header>
      
      <main>
        {socket ? (
          <TradingDashboard socket={socket} />
        ) : (
          <div className="loading">
            <div className="spinner"></div>
            <p>Connecting to trading server...</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App
