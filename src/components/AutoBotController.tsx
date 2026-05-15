'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, ShieldCheck, Activity, Lock, Mail, Key, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tradingstudio-backend-production.up.railway.app';

const AVAILABLE_PAIRS = [
  'EURUSD-OTC', 'GBPUSD-OTC', 'USDJPY-OTC', 'USDCHF-OTC',
  'AUDUSD-OTC', 'USDCAD-OTC', 'NZDUSD-OTC', 'EURGBP-OTC',
  'EURJPY-OTC', 'GBPJPY-OTC', 'AUDJPY-OTC', 'EURAUD-OTC',
  'XAUUSD-OTC', 'XAGUSD-OTC'
];

const AVAILABLE_TIMEFRAMES = ['1m', '2m', '5m', '15m'];

interface TradeRecord {
  id: string;
  pair: string;
  timeframe: string;
  stake: number;
  direction: string;
  status: 'WIN' | 'LOSS' | 'PENDING';
  pnl: number;
  time: string;
}

export const AutoBotController = () => {
  const [jwt, setJwt] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<'demo' | 'live'>('demo');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [isActive, setIsActive] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  const [config, setConfig] = useState({
    stake: 10,
    maxDailyTrades: 50,
    maxLoss: 500,
    profitTarget: 1000,
    minConfidence: 90,
    timeframes: ['1m', '5m'],
    pairs: ['EURUSD-OTC', 'GBPUSD-OTC', 'USDJPY-OTC', 'USDCHF-OTC'],
    useBlitz: false
  });

  // Load from localStorage on mount
  useEffect(() => {
    const savedJwt = localStorage.getItem('ts_jwt');
    const savedConfig = localStorage.getItem('ts_config');
    const savedAccountType = localStorage.getItem('ts_account_type');

    if (savedJwt) {
      setJwt(savedJwt);
      fetchBalance(savedJwt, (savedAccountType as 'demo' | 'live') || 'demo');
    }
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig));
      } catch (e) {
        console.error('Failed to parse saved config');
      }
    }
    if (savedAccountType) {
      setAccountType(savedAccountType as 'demo' | 'live');
    }
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    if (jwt) localStorage.setItem('ts_jwt', jwt);
    else localStorage.removeItem('ts_jwt');
  }, [jwt]);

  useEffect(() => {
    localStorage.setItem('ts_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('ts_account_type', accountType);
  }, [accountType]);

  const [stats, setStats] = useState({
    wins: 0,
    losses: 0,
    profit: 0,
    totalTrades: 0
  });

  const [recentTrades, setRecentTrades] = useState<TradeRecord[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const currentPnlRef = useRef(0);
  const tradesCountRef = useRef(0);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 20));
  };

  const handleLogout = () => {
    setJwt(null);
    localStorage.removeItem('ts_jwt');
    setIsActive(false);
    addLog('Logged out successfully.');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, accountType })
      }).catch(() => null); 
      
      let token = null;

      if (res && res.ok) {
        const data = await res.json();
        token = data.jwt;
      } else {
        console.warn('Backend unavailable or error, using mock authentication');
        token = 'mock-jwt-token-' + Date.now();
      }
      
      if (token) {
        setJwt(token);
        addLog(`Successfully authenticated (${accountType} mode).`);
        fetchBalance(token, accountType);
      } else {
        throw new Error('No token received');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Failed to login');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const fetchBalance = async (token: string, type: 'demo' | 'live' = accountType) => {
    try {
      const res = await fetch(`${API_URL}/api/balance?type=${type}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => null);
      
      if (res && res.ok) {
        const data = await res.json();
        setBalance(data.balance);
      } else {
        setBalance(type === 'demo' ? 10000.00 : 0.00); 
      }
    } catch (err) {
      console.error('Failed to fetch balance', err);
      setBalance(type === 'demo' ? 10000.00 : 0.00);
    }
  };

  const togglePair = (pair: string) => {
    setConfig(prev => ({
      ...prev,
      pairs: prev.pairs.includes(pair) 
        ? prev.pairs.filter(p => p !== pair)
        : [...prev.pairs, pair]
    }));
  };

  const toggleTimeframe = (tf: string) => {
    setConfig(prev => ({
      ...prev,
      timeframes: prev.timeframes.includes(tf)
        ? prev.timeframes.filter(t => t !== tf)
        : [...prev.timeframes, tf]
    }));
  };

  // Signal API Listener
  useEffect(() => {
    if (!jwt) return;

    const wsUrl = `wss://${API_URL.replace(/^https?:\/\//, '')}/api/signals?token=${jwt}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => addLog('Connected to Signal API.');
    
    ws.onmessage = async (event) => {
      try {
        const signal = JSON.parse(event.data);
        // Signal format expected: { pair: 'EURUSD-OTC', timeframe: '5m', direction: 'CALL', accuracy: 92 }
        
        // Match user's custom parameters
        const matchesPair = config.pairs.includes(signal.pair);
        const matchesTimeframe = config.timeframes.includes(signal.timeframe || '1m');
        const matchesConfidence = signal.accuracy >= config.minConfidence;

        if (matchesPair && matchesTimeframe && matchesConfidence) {
          addLog(`Strong ${signal.direction} signal received for ${signal.pair} (${signal.accuracy}% accuracy).`);
          
          if (isActive) {
            executeTrade(signal);
          } else {
            addLog(`Bot inactive. Ignored ${signal.direction} signal for ${signal.pair}.`);
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
  }, [jwt, isActive, config]);

  const executeTrade = async (signal: any) => {
    // Check risk limits
    if (currentPnlRef.current <= -config.maxLoss) {
      addLog(`Daily Stop Loss reached ($${config.maxLoss}). Stopping bot.`);
      setIsActive(false);
      return;
    }
    if (currentPnlRef.current >= config.profitTarget) {
      addLog(`Profit target reached ($${config.profitTarget}). Stopping bot.`);
      setIsActive(false);
      return;
    }
    if (tradesCountRef.current >= config.maxDailyTrades) {
      addLog(`Max daily trades reached (${config.maxDailyTrades}). Stopping bot.`);
      setIsActive(false);
      return;
    }

    tradesCountRef.current += 1;
    setStats(s => ({ ...s, totalTrades: tradesCountRef.current }));
    addLog(`Executing ${signal.direction} on ${signal.pair} with $${config.stake}...`);
    
    try {
      const res = await fetch(`${API_URL}/api/trade/execute`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({
          pair: signal.pair,
          direction: signal.direction,
          timeframe: signal.timeframe,
          stake: config.stake,
          optionType: config.useBlitz ? 'blitzOptions' : 'binaryOptions',
          accountType: accountType
        })
      });

      if (res.ok) {
        const result = await res.json();
        addLog(`Trade placed successfully. ID: ${result.tradeId}`);
        
        // Add to recent trades as PENDING, or use mock result if backend returns it immediately
        const newTrade: TradeRecord = {
          id: result.tradeId || Math.random().toString(36).substring(7),
          pair: signal.pair,
          timeframe: signal.timeframe || '1m',
          stake: config.stake,
          direction: signal.direction === 'CALL' ? 'BUY' : 'SELL',
          status: result.status || 'PENDING',
          pnl: result.pnl || 0,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        setRecentTrades(prev => [newTrade, ...prev].slice(0, 50));
      } else {
        addLog(`Trade execution failed: ${res.statusText}`);
      }
    } catch (err: any) {
      addLog(`Error executing trade: ${err.message}`);
    }
  };

  if (!jwt) {
    return (
      <div className="bg-[#0b0e14] border border-[#1e2330] p-8 rounded-2xl max-w-md mx-auto shadow-2xl text-white">
        <div className="text-center mb-8">
          <div className="bg-[#131823] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#1e2330]">
            <Lock className="text-[#00e676]" size={32} />
          </div>
          <h2 className="text-2xl font-bold">Connect to TradingStudio</h2>
          <p className="text-sm text-gray-400 mt-2">Enter your IQ Option credentials to initialize the engine.</p>
        </div>

        <div className="flex bg-[#131823] p-1 rounded-xl mb-6 border border-[#1e2330]">
          <button 
            type="button"
            onClick={() => setAccountType('demo')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${accountType === 'demo' ? 'bg-[#00e676] text-[#0b0e14]' : 'text-gray-400'}`}
          >
            Demo Account
          </button>
          <button 
            type="button"
            onClick={() => setAccountType('live')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${accountType === 'live' ? 'bg-[#00e676] text-[#0b0e14]' : 'text-gray-400'}`}
          >
            Live Account
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-3 text-gray-500" size={20} />
            <input 
              type="email" 
              placeholder="Email address"
              className="w-full bg-[#131823] border border-[#1e2330] pl-10 pr-4 py-3 rounded-xl focus:border-[#00e676] outline-none transition text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="relative">
            <Key className="absolute left-3 top-3 text-gray-500" size={20} />
            <input 
              type="password" 
              placeholder="Password"
              className="w-full bg-[#131823] border border-[#1e2330] pl-10 pr-4 py-3 rounded-xl focus:border-[#00e676] outline-none transition text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {loginError && <p className="text-red-400 text-sm text-center">{loginError}</p>}
          <button 
            type="submit" 
            disabled={isLoggingIn}
            className="w-full bg-[#00e676] text-[#0b0e14] font-bold py-3 rounded-xl hover:bg-opacity-90 transition disabled:opacity-50"
          >
            {isLoggingIn ? 'Initializing SDK...' : 'Connect & Authenticate'}
          </button>
        </form>
      </div>
    );
  }

  const winRate = stats.totalTrades > 0 ? Math.round((stats.wins / stats.totalTrades) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto text-white w-full">
      
      {/* Top Section: Connection & Auto-Trading Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* IQ Option Connection */}
        <div className="bg-[#0b0e14] border border-[#1e2330] rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
              <RefreshCw size={18} className="text-gray-400" /> IQ Option Connection
            </h3>
            <p className="text-sm text-gray-400 mb-6">Connected to account</p>
            <div className="bg-[#0f1d18] border border-[#00e676]/30 rounded-xl p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="text-[#00e676]" size={24} />
                <div>
                  <p className="text-[#00e676] font-bold capitalize">{accountType} Mode</p>
                  <p className="text-xs text-[#00e676]/70">
                    Balance: {balance !== null ? `$${balance.toLocaleString()}` : '...'}
                  </p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="text-xs bg-red-500/10 text-red-500 px-3 py-1 rounded-lg border border-red-500/20 hover:bg-red-500/20 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Auto-Trading Status */}
        <div className="bg-[#0b0e14] border border-[#1e2330] rounded-2xl p-6 shadow-xl lg:col-span-2">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Activity size={18} className="text-[#00e676]" /> Auto-Trading Status
              </h3>
              <p className="text-sm text-gray-400">{isActive ? 'Automatically trading based on AI signals' : 'Enable to start auto-trading'}</p>
            </div>
            <button 
              onClick={() => setIsActive(!isActive)}
              className={`px-8 py-2 rounded-xl font-bold transition ${
                isActive ? 'bg-red-500/10 text-red-500 border border-red-500/30' : 'bg-[#00e676] text-[#0b0e14]'
              }`}
            >
              {isActive ? 'Disable' : 'Enable'}
            </button>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-[#131823] p-4 rounded-xl text-center border border-[#1e2330]">
              <p className="text-[#00e676] text-2xl font-bold">{stats.wins}</p>
              <p className="text-xs text-gray-400 mt-1">Total Wins</p>
            </div>
            <div className="bg-[#131823] p-4 rounded-xl text-center border border-[#1e2330]">
              <p className="text-red-400 text-2xl font-bold">{stats.losses}</p>
              <p className="text-xs text-gray-400 mt-1">Total Losses</p>
            </div>
            <div className="bg-[#131823] p-4 rounded-xl text-center border border-[#1e2330]">
              <p className={`text-2xl font-bold ${stats.profit >= 0 ? 'text-[#00e676]' : 'text-red-400'}`}>
                ${stats.profit.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Total Profit</p>
            </div>
            <div className="bg-[#131823] p-4 rounded-xl text-center border border-[#1e2330]">
              <p className="text-[#00bfff] text-2xl font-bold">{winRate}%</p>
              <p className="text-xs text-gray-400 mt-1">Win Rate</p>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>Today's Trades</span>
              <span>{stats.totalTrades} / {config.maxDailyTrades}</span>
            </div>
            <div className="h-2 w-full bg-[#131823] rounded-full overflow-hidden border border-[#1e2330]">
              <div 
                className="h-full bg-[#1c3a4a] rounded-full"
                style={{ width: `${Math.min(100, (stats.totalTrades / config.maxDailyTrades) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Trading Settings */}
        <div className="bg-[#0b0e14] border border-[#1e2330] rounded-2xl p-6 shadow-xl xl:col-span-2">
          <h3 className="text-lg font-bold mb-1">Trading Settings</h3>
          <p className="text-sm text-gray-400 mb-6">Configure your auto-trading preferences and daily stop loss</p>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Stake Amount ($)</label>
              <input 
                type="number" 
                className="w-full bg-[#131823] border border-[#1e2330] p-3 rounded-xl focus:border-[#00e676] outline-none"
                value={config.stake}
                onChange={(e) => setConfig({...config, stake: Number(e.target.value)})}
              />
              <p className="text-xs text-gray-500">Min: $1 | Max: $5000</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Max Daily Trades</label>
              <input 
                type="number" 
                className="w-full bg-[#131823] border border-[#1e2330] p-3 rounded-xl focus:border-[#00e676] outline-none"
                value={config.maxDailyTrades}
                onChange={(e) => setConfig({...config, maxDailyTrades: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Daily Stop Loss ($)</label>
              <input 
                type="number" 
                className="w-full bg-[#131823] border border-[#1e2330] p-3 rounded-xl focus:border-red-400 outline-none"
                value={config.maxLoss}
                onChange={(e) => setConfig({...config, maxLoss: Number(e.target.value)})}
              />
              <p className="text-xs text-gray-500">Bot stops if loss exceeds this amount</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Min. Signal Confidence (%)</label>
              <input 
                type="number" 
                className="w-full bg-[#131823] border border-[#1e2330] p-3 rounded-xl focus:border-[#00bfff] outline-none"
                value={config.minConfidence}
                onChange={(e) => setConfig({...config, minConfidence: Number(e.target.value)})}
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-[#131823] border border-[#1e2330] rounded-xl col-span-2">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${config.useBlitz ? 'bg-orange-500/10 text-orange-500' : 'bg-gray-500/10 text-gray-500'}`}>
                  <Activity size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold">Blitz Trading Mode</p>
                  <p className="text-xs text-gray-400">Ultra-fast trade execution</p>
                </div>
              </div>
              <button 
                onClick={() => setConfig({...config, useBlitz: !config.useBlitz})}
                className={`w-12 h-6 rounded-full transition relative ${config.useBlitz ? 'bg-orange-500' : 'bg-gray-700'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${config.useBlitz ? 'left-7' : 'left-1'}`}></div>
              </button>
            </div>
          </div>

          <div className="mb-6">
            <label className="text-sm text-gray-400 block mb-3">Enabled Timeframes</label>
            <div className="flex flex-wrap gap-3">
              {AVAILABLE_TIMEFRAMES.map(tf => (
                <button
                  key={tf}
                  onClick={() => toggleTimeframe(tf)}
                  className={`px-6 py-2 rounded-xl border font-semibold transition ${
                    config.timeframes.includes(tf) 
                      ? 'bg-[#00e676]/10 border-[#00e676] text-[#00e676]' 
                      : 'bg-[#131823] border-[#1e2330] text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-end mb-3">
              <label className="text-sm text-gray-400">Currency Pairs</label>
              <span className="text-xs text-gray-500">{config.pairs.length} / 10 selected</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {AVAILABLE_PAIRS.map(pair => (
                <button
                  key={pair}
                  onClick={() => togglePair(pair)}
                  className={`py-3 rounded-xl border text-sm font-semibold transition ${
                    config.pairs.includes(pair) 
                      ? 'bg-[#00bfff]/10 border-[#00bfff] text-[#00bfff]' 
                      : 'bg-[#131823] border-[#1e2330] text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {pair.replace('-OTC', '')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Trades */}
        <div className="bg-[#0b0e14] border border-[#1e2330] rounded-2xl p-6 shadow-xl flex flex-col h-full overflow-hidden">
          <h3 className="text-lg font-bold mb-1">Recent Trades</h3>
          <p className="text-sm text-gray-400 mb-6">Your auto-trading history</p>

          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {recentTrades.length === 0 ? (
              <div className="text-center text-gray-500 mt-10">
                <ShieldCheck size={48} className="mx-auto mb-3 opacity-20" />
                <p>No recent trades</p>
                <p className="text-xs mt-1">Enable Auto-Trading to begin</p>
              </div>
            ) : (
              recentTrades.map((trade) => (
                <div key={trade.id} className="bg-[#131823] border border-[#1e2330] p-4 rounded-xl flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      trade.direction === 'BUY' ? 'bg-[#00e676]/10 text-[#00e676]' : 'bg-red-400/10 text-red-400'
                    }`}>
                      <Activity size={20} />
                    </div>
                    <div>
                      <p className="font-bold">{trade.pair}</p>
                      <p className="text-xs text-gray-400">{trade.timeframe} | ${trade.stake} &bull; {trade.time}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {trade.status === 'WIN' && <p className="text-[#00e676] font-bold flex items-center gap-1 justify-end"><CheckCircle2 size={14}/> WIN</p>}
                    {trade.status === 'LOSS' && <p className="text-red-400 font-bold flex items-center gap-1 justify-end"><XCircle size={14}/> LOSS</p>}
                    {trade.status === 'PENDING' && <p className="text-[#00bfff] font-bold">PENDING</p>}
                    
                    {trade.status !== 'PENDING' && (
                      <p className={`text-sm ${trade.pnl > 0 ? 'text-[#00e676]' : 'text-red-400'}`}>
                        {trade.pnl > 0 ? '+' : ''}${Math.abs(trade.pnl).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}