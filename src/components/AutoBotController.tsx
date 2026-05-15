'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, ShieldCheck, Activity, Lock, Mail, Key } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tradingstudio-backend-production.up.railway.app';

export const AutoBotController = () => {
  const [jwt, setJwt] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [isActive, setIsActive] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [config, setConfig] = useState({
    stake: 10,
    maxLoss: 50,
    profitTarget: 100,
    pair: 'EURUSD-OTC'
  });

  const wsRef = useRef<WebSocket | null>(null);
  const currentPnlRef = useRef(0);

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 10)); // keep last 10 logs
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    try {
      // Send credentials to Railway backend to initialize SDK and get JWT
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (!res.ok) throw new Error('Authentication failed');
      const data = await res.json();
      
      if (data.jwt) {
        setJwt(data.jwt);
        addLog('Successfully authenticated and SDK initialized.');
        fetchBalance(data.jwt);
      } else {
        throw new Error('No token received');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Failed to login');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const fetchBalance = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/api/balance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
      }
    } catch (err) {
      console.error('Failed to fetch balance', err);
    }
  };

  // Signal API Listener
  useEffect(() => {
    if (!jwt) return;

    // Connect to Backend Signal WebSocket
    const ws = new WebSocket(`wss://${API_URL.replace(/^https?:\/\//, '')}/api/signals?token=${jwt}`);
    wsRef.current = ws;

    ws.onopen = () => addLog('Connected to Signal API.');
    
    ws.onmessage = async (event) => {
      try {
        const signal = JSON.parse(event.data);
        // Signal format expected: { pair: 'EURUSD-OTC', direction: 'CALL', accuracy: 92 }
        if (signal.pair === config.pair && signal.accuracy > 90) {
          addLog(`Strong ${signal.direction} signal received (${signal.accuracy}% accuracy).`);
          
          if (isActive) {
            executeTrade(signal.direction);
          } else {
            addLog(`Bot inactive. Ignored ${signal.direction} signal.`);
          }
        }
      } catch (e) {
        console.error('Error parsing signal', e);
      }
    };

    ws.onclose = () => addLog('Disconnected from Signal API.');

    return () => {
      ws.close();
    };
  }, [jwt, isActive, config.pair]);

  const executeTrade = async (direction: string) => {
    // Check risk limits before trading
    if (currentPnlRef.current <= -config.maxLoss) {
      addLog(`Max loss reached ($${config.maxLoss}). Stopping bot.`);
      setIsActive(false);
      return;
    }
    if (currentPnlRef.current >= config.profitTarget) {
      addLog(`Profit target reached ($${config.profitTarget}). Stopping bot.`);
      setIsActive(false);
      return;
    }

    addLog(`Executing ${direction} trade with $${config.stake}...`);
    try {
      // Execute trade via Railway Backend
      const res = await fetch(`${API_URL}/api/trade/execute`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({
          pair: config.pair,
          direction,
          stake: config.stake,
          optionType: 'binaryOptions' // Default as requested
        })
      });

      if (res.ok) {
        const result = await res.json();
        addLog(`Trade placed successfully. ID: ${result.tradeId}`);
        // Mock updating PnL based on result later (via Webhooks or WS updates)
      } else {
        addLog(`Trade execution failed: ${res.statusText}`);
      }
    } catch (err: any) {
      addLog(`Error executing trade: ${err.message}`);
    }
  };

  if (!jwt) {
    return (
      <div className="bg-studio-card border border-studio-border p-8 rounded-2xl max-w-md mx-auto shadow-xl">
        <div className="text-center mb-8">
          <div className="bg-studio-bg w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-studio-border">
            <Lock className="text-studio-accent" size={32} />
          </div>
          <h2 className="text-2xl font-bold">Connect to TradingStudio</h2>
          <p className="text-sm text-white/50 mt-2">Enter your IQ Option credentials to initialize the engine.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-3 text-white/40" size={20} />
            <input 
              type="email" 
              placeholder="Email address"
              className="w-full bg-studio-bg border border-studio-border pl-10 pr-4 py-3 rounded-xl focus:border-studio-accent outline-none transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="relative">
            <Key className="absolute left-3 top-3 text-white/40" size={20} />
            <input 
              type="password" 
              placeholder="Password"
              className="w-full bg-studio-bg border border-studio-border pl-10 pr-4 py-3 rounded-xl focus:border-studio-accent outline-none transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {loginError && <p className="text-studio-danger text-sm text-center">{loginError}</p>}
          <button 
            type="submit" 
            disabled={isLoggingIn}
            className="w-full bg-studio-accent text-black font-bold py-3 rounded-xl hover:bg-opacity-90 transition disabled:opacity-50"
          >
            {isLoggingIn ? 'Initializing SDK...' : 'Connect & Authenticate'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-studio-card border border-studio-border p-6 rounded-2xl shadow-xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="text-studio-accent" /> AI Execution Engine
          </h3>
          {balance !== null && (
            <p className="text-sm text-white/60 mt-1 font-mono">Current Balance: ${balance.toFixed(2)}</p>
          )}
        </div>
        <button 
          onClick={() => setIsActive(!isActive)}
          className={`px-8 py-3 rounded-full font-bold flex items-center gap-2 transition transform hover:scale-105 ${
            isActive ? 'bg-studio-danger text-white shadow-[0_0_15px_rgba(255,68,68,0.5)]' : 'bg-studio-accent text-black shadow-[0_0_15px_rgba(0,255,136,0.3)]'
          }`}
        >
          {isActive ? <><Square size={20}/> Stop Bot</> : <><Play size={20}/> Start Auto-Trade</>}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <div className="space-y-2 bg-studio-bg p-4 rounded-xl border border-studio-border">
          <label className="text-xs text-white/40 uppercase tracking-wider font-semibold">Stake ($)</label>
          <input 
            type="number" 
            className="w-full bg-transparent text-xl font-bold focus:text-studio-accent outline-none"
            value={config.stake}
            onChange={(e) => setConfig({...config, stake: Number(e.target.value)})}
          />
        </div>
        <div className="space-y-2 bg-studio-bg p-4 rounded-xl border border-studio-border">
          <label className="text-xs text-white/40 uppercase tracking-wider font-semibold">Stop Loss ($)</label>
          <input 
            type="number" 
            className="w-full bg-transparent text-xl font-bold focus:text-studio-danger outline-none"
            value={config.maxLoss} 
            onChange={(e) => setConfig({...config, maxLoss: Number(e.target.value)})}
          />
        </div>
        <div className="space-y-2 bg-studio-bg p-4 rounded-xl border border-studio-border">
          <label className="text-xs text-white/40 uppercase tracking-wider font-semibold">Profit Target ($)</label>
          <input 
            type="number" 
            className="w-full bg-transparent text-xl font-bold focus:text-studio-accent outline-none"
            value={config.profitTarget} 
            onChange={(e) => setConfig({...config, profitTarget: Number(e.target.value)})}
          />
        </div>
        <div className="space-y-2 bg-studio-bg p-4 rounded-xl border border-studio-border">
          <label className="text-xs text-white/40 uppercase tracking-wider font-semibold">Asset</label>
          <select 
            className="w-full bg-transparent text-lg font-bold outline-none cursor-pointer"
            value={config.pair}
            onChange={(e) => setConfig({...config, pair: e.target.value})}
          >
            <option className="bg-studio-card">EURUSD-OTC</option>
            <option className="bg-studio-card">GBPUSD-OTC</option>
          </select>
        </div>
      </div>

      {isActive && (
        <div className="mb-6 p-4 bg-studio-accent/10 border border-studio-accent/20 rounded-xl animate-pulse flex items-center gap-4">
          <ShieldCheck className="text-studio-accent w-6 h-6" />
          <div>
            <p className="text-studio-accent font-bold">Engine Live</p>
            <p className="text-sm text-studio-accent/80 font-mono mt-1">Listening for {config.pair} signals with >90% accuracy...</p>
          </div>
        </div>
      )}

      {/* Terminal / Logs Section */}
      <div className="bg-[#0a0a0a] border border-studio-border rounded-xl p-4 h-48 overflow-y-auto font-mono text-sm">
        <div className="text-white/40 mb-2 border-b border-studio-border pb-2">Terminal Output</div>
        {logs.map((log, i) => (
          <div key={i} className="mb-1 text-white/80">
            <span className="text-studio-accent mr-2">[{new Date().toLocaleTimeString()}]</span>
            {log}
          </div>
        ))}
        {logs.length === 0 && <div className="text-white/20 italic">Waiting for events...</div>}
      </div>
    </div>
  );
};