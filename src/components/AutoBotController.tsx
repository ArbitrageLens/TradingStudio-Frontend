'use client';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, ShieldCheck, Activity, Lock, Mail, Key, CheckCircle2, XCircle, RefreshCw, Terminal, Signal } from 'lucide-react';

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

let API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tradingstudio-backend-production.up.railway.app';
if (API_URL && !API_URL.startsWith('http')) {
  API_URL = `https://${API_URL}`;
}

export const AutoBotController = () => {
  const [jwt, setJwt] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<'demo' | 'live'>('demo');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [isActive, setIsActive] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isWsConnected, setIsWsConnected] = useState(false);
  
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
    const savedIsActive = localStorage.getItem('ts_is_active');

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
    if (savedIsActive === 'true') {
      setIsActive(true);
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

  useEffect(() => {
    localStorage.setItem('ts_is_active', isActive.toString());
  }, [isActive]);

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
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  };

  const handleLogout = () => {
    setJwt(null);
    localStorage.removeItem('ts_jwt');
    setIsActive(false);
    addLog('Session terminated.');
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
      } else if (res && res.status === 401) {
        const data = await res.json();
        throw new Error(data.error || 'Authentication failed');
      } else {
        throw new Error('Could not connect to Trading Engine. Please check your Railway deployment.');
      }
      
      if (token) {
        setJwt(token);
        addLog(`Successfully authenticated (${accountType} mode).`);
        fetchBalance(token, accountType);
      }
    } catch (err: any) {
      setLoginError(err.message || 'Failed to login');
      addLog(`Login Error: ${err.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_URL}/`).catch(() => null);
      if (res && res.ok) {
        const text = await res.text();
        setTestResult(`Success: ${text}`);
        addLog(`Engine Connection Verified: ${text}`);
      } else {
        setTestResult(`Failed: ${res?.status || 'Network Error'}`);
        addLog(`Engine Connection Failed: ${res?.status || 'Network Error'}`);
      }
    } catch (err: any) {
      setTestResult(`Error: ${err.message}`);
      addLog(`Engine Connection Error: ${err.message}`);
    } finally {
      setIsTesting(false);
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
        addLog(`Balance synchronized: $${data.balance.toLocaleString()}`);
      } else {
        setBalance(null);
        addLog(`Warning: Could not fetch ${type} balance from server.`);
      }
    } catch (err) {
      console.error('Failed to fetch balance', err);
      setBalance(null);
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

    ws.onopen = () => {
      addLog('Signal API: Connected & Authenticated.');
      setIsWsConnected(true);
    };
    
    ws.onmessage = async (event) => {
      try {
        const signal = JSON.parse(event.data);
        if (signal.type === 'info') return;

        // Match user's custom parameters
        const matchesPair = config.pairs.includes(signal.pair);
        const matchesTimeframe = config.timeframes.includes(signal.timeframe || '1m');
        const matchesConfidence = signal.accuracy >= config.minConfidence;

        if (matchesPair && matchesTimeframe && matchesConfidence) {
          addLog(`AI Signal: ${signal.pair} ${signal.direction} (${signal.accuracy}%)`);
          
          if (isActive) {
            executeTrade(signal);
          }
        }
      } catch (e) {
        console.error('Error parsing signal', e);
      }
    };

    ws.onclose = () => {
      addLog('Signal API: Connection Lost.');
      setIsWsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [jwt, isActive, config]);

  const executeTrade = async (signal: any) => {
    // Check risk limits
    if (currentPnlRef.current <= -config.maxLoss) {
      addLog(`Daily Stop Loss reached. Stopping bot.`);
      setIsActive(false);
      return;
    }
    if (tradesCountRef.current >= config.maxDailyTrades) {
      addLog(`Max daily trades reached. Stopping bot.`);
      setIsActive(false);
      return;
    }

    tradesCountRef.current += 1;
    setStats(s => ({ ...s, totalTrades: tradesCountRef.current }));
    addLog(`Executing ${signal.direction} on ${signal.pair} ($${config.stake})...`);
    
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
        addLog(`Trade Success: ${result.tradeId}`);
        fetchBalance(jwt!, accountType); 
        
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
        const data = await res.json();
        addLog(`Trade Error: ${data.error || res.statusText}`);
      }
    } catch (err: any) {
      addLog(`Trade Execution Critical Error: ${err.message}`);
    }
  };

  if (!jwt) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0b0e14]/80 backdrop-blur-2xl border border-white/10 p-10 rounded-[2.5rem] max-w-lg mx-auto shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] text-white relative overflow-hidden group"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00e676] to-transparent opacity-50"></div>
        
        <div className="text-center mb-10 relative">
          <motion.div 
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            className="bg-white/5 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-inner group-hover:border-[#00e676]/50 transition-colors duration-500"
          >
            <Lock className="text-[#00e676]" size={36} />
          </motion.div>
          <h2 className="text-3xl font-extrabold tracking-tight">TradingStudio <span className="text-[#00e676]">Pro</span></h2>
          <p className="text-sm text-gray-500 mt-3 font-medium">Enterprise-grade automation for IQ Option.</p>
        </div>

        <div className="flex bg-black/40 p-1.5 rounded-2xl mb-8 border border-white/5">
          <button 
            type="button"
            onClick={() => setAccountType('demo')}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${accountType === 'demo' ? 'bg-[#00e676] text-[#0b0e14] shadow-lg shadow-[#00e676]/20' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Practice
          </button>
          <button 
            type="button"
            onClick={() => setAccountType('live')}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${accountType === 'live' ? 'bg-[#00bfff] text-[#0b0e14] shadow-lg shadow-[#00bfff]/20' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Real Account
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#00e676] transition-colors" size={18} />
              <input 
                type="email" 
                placeholder="IQ Option Email"
                className="w-full bg-white/5 border border-white/5 pl-12 pr-4 py-4 rounded-2xl focus:bg-white/10 focus:border-[#00e676]/50 outline-none transition-all text-sm font-medium"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Secure Password</label>
            <div className="relative group">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#00e676] transition-colors" size={18} />
              <input 
                type="password" 
                placeholder="IQ Option Password"
                className="w-full bg-white/5 border border-white/5 pl-12 pr-4 py-4 rounded-2xl focus:bg-white/10 focus:border-[#00e676]/50 outline-none transition-all text-sm font-medium"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <AnimatePresence>
            {loginError && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold p-3 rounded-xl flex items-center gap-2">
                  <XCircle size={14} /> {loginError}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            type="submit" 
            disabled={isLoggingIn}
            className="w-full bg-white text-[#0b0e14] font-black py-4 rounded-2xl hover:bg-opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 shadow-xl"
          >
            {isLoggingIn ? (
              <div className="flex items-center justify-center gap-3">
                <RefreshCw className="animate-spin" size={18} />
                <span>ESTABLISHING HANDSHAKE...</span>
              </div>
            ) : 'ACCESS DASHBOARD'}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-white/5 text-center">
          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
            <ShieldCheck size={12} /> End-to-End Encryption Active
          </p>
        </div>
      </motion.div>
    );
  }

  const winRate = stats.totalTrades > 0 ? Math.round((stats.wins / stats.totalTrades) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto text-white w-full pb-20">
      
      {/* Top Section: Connection & Auto-Trading Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* IQ Option Connection */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-[#0b0e14]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl flex flex-col justify-between"
        >
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
              <RefreshCw size={18} className="text-gray-400" /> Account Context
            </h3>
            <p className="text-sm text-gray-400 mb-6 font-mono text-[10px] opacity-50">{email}</p>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${accountType === 'live' ? 'bg-[#00e676]/10 text-[#00e676]' : 'bg-[#00bfff]/10 text-[#00bfff]'}`}>
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold capitalize">{accountType} Mode</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-mono font-bold">
                      {balance !== null ? `$${balance.toLocaleString()}` : '---'}
                    </p>
                    <button 
                      onClick={() => jwt && fetchBalance(jwt)}
                      className="text-gray-500 hover:text-white transition-colors"
                      title="Sync Balance"
                    >
                      <RefreshCw size={14} className={isTesting ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={handleLogout}
                className="w-full text-xs bg-red-500/10 text-red-400 py-3 rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all font-bold"
              >
                Terminate Session
              </button>
              <div className="flex items-center justify-center gap-2 opacity-30">
                <div className="w-1 h-1 rounded-full bg-gray-500"></div>
                <p className="text-[10px] text-gray-500 font-mono">{API_URL.replace('https://', '')}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Auto-Trading Status */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0b0e14]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl lg:col-span-2"
        >
          <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-3">
                <Activity size={22} className="text-[#00e676]" /> Trading Engine
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                Status: {isActive ? 'Running (Listening for Signals)' : 'Standby (Ready to Start)'}
              </p>
            </div>
            <button 
              onClick={() => setIsActive(!isActive)}
              className={`px-10 py-3 rounded-2xl font-bold transition-all shadow-lg ${
                isActive 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'bg-gradient-to-r from-[#00e676] to-[#00bfff] text-[#0b0e14] hover:scale-105 active:scale-95'
              }`}
            >
              {isActive ? 'SHUTDOWN' : 'ACTIVATE ENGINE'}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Successful', value: stats.wins, color: 'text-[#00e676]' },
              { label: 'Unsuccessful', value: stats.losses, color: 'text-red-400' },
              { label: 'Net Profit', value: `$${stats.profit.toFixed(2)}`, color: stats.profit >= 0 ? 'text-[#00e676]' : 'text-red-400' },
              { label: 'Efficiency', value: `${winRate}%`, color: 'text-[#00bfff]' }
            ].map((stat, i) => (
              <div key={i} className="bg-white/5 p-5 rounded-2xl border border-white/5 text-center">
                <p className={`text-2xl font-mono font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="relative pt-2">
            <div className="flex justify-between text-[10px] text-gray-500 uppercase tracking-widest mb-2 px-1">
              <span>Current Session Load</span>
              <span>{stats.totalTrades} / {config.maxDailyTrades} Trades</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (stats.totalTrades / config.maxDailyTrades) * 100)}%` }}
                className="h-full bg-gradient-to-r from-[#00e676] to-[#00bfff] rounded-full"
              ></motion.div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Trading Settings */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#0b0e14]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl xl:col-span-2"
        >
          <h3 className="text-xl font-bold mb-1">Configuration</h3>
          <p className="text-sm text-gray-400 mb-8">Risk parameters & asset selection</p>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Stake / Trade</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm">$</span>
                <input 
                  type="number" 
                  className="w-full bg-white/5 border border-white/5 pl-8 pr-4 py-4 rounded-2xl focus:border-[#00e676]/50 outline-none transition-all font-mono"
                  value={config.stake}
                  onChange={(e) => setConfig({...config, stake: Number(e.target.value)})}
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Session Limit</label>
              <input 
                type="number" 
                className="w-full bg-white/5 border border-white/5 px-4 py-4 rounded-2xl focus:border-[#00e676]/50 outline-none transition-all font-mono"
                value={config.maxDailyTrades}
                onChange={(e) => setConfig({...config, maxDailyTrades: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Daily Stop Loss</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500/50 font-mono text-sm">$</span>
                <input 
                  type="number" 
                  className="w-full bg-white/5 border border-white/5 pl-8 pr-4 py-4 rounded-2xl focus:border-red-400/50 outline-none transition-all font-mono"
                  value={config.maxLoss}
                  onChange={(e) => setConfig({...config, maxLoss: Number(e.target.value)})}
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Min Confidence</label>
              <div className="relative">
                <input 
                  type="number" 
                  className="w-full bg-white/5 border border-white/5 px-4 py-4 rounded-2xl focus:border-[#00bfff]/50 outline-none transition-all font-mono"
                  value={config.minConfidence}
                  onChange={(e) => setConfig({...config, minConfidence: Number(e.target.value)})}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm">%</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-6 bg-white/5 border border-white/5 rounded-3xl col-span-2 hover:bg-white/10 transition-all group">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl transition-all ${config.useBlitz ? 'bg-orange-500 text-[#0b0e14]' : 'bg-white/5 text-gray-500'}`}>
                  <Activity size={24} />
                </div>
                <div>
                  <p className="text-lg font-bold">Blitz Mode (60s)</p>
                  <p className="text-xs text-gray-400">Execute ultra-fast turbo options</p>
                </div>
              </div>
              <button 
                onClick={() => setConfig({...config, useBlitz: !config.useBlitz})}
                className={`w-14 h-7 rounded-full transition-all relative ${config.useBlitz ? 'bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.4)]' : 'bg-white/10'}`}
              >
                <motion.div 
                  animate={{ x: config.useBlitz ? 28 : 4 }}
                  className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-md"
                ></motion.div>
              </button>
            </div>
          </div>

          <div className="mb-8">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1 block mb-4">Target Timeframes</label>
            <div className="flex flex-wrap gap-4">
              {AVAILABLE_TIMEFRAMES.map(tf => (
                <button
                  key={tf}
                  onClick={() => toggleTimeframe(tf)}
                  className={`px-8 py-3 rounded-2xl border font-bold transition-all ${
                    config.timeframes.includes(tf) 
                      ? 'bg-[#00e676] text-[#0b0e14] border-transparent shadow-lg shadow-[#00e676]/20' 
                      : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1 block mb-4">Active Assets</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {AVAILABLE_PAIRS.map(pair => (
                <button
                  key={pair}
                  onClick={() => togglePair(pair)}
                  className={`py-4 rounded-2xl border text-xs font-bold transition-all truncate px-2 ${
                    config.pairs.includes(pair) 
                      ? 'bg-[#00bfff] text-[#0b0e14] border-transparent shadow-lg shadow-[#00bfff]/20' 
                      : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {pair.replace('-OTC', '')}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Trade History */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#0b0e14]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl flex flex-col h-full overflow-hidden"
        >
          <h3 className="text-xl font-bold mb-1">Live History</h3>
          <p className="text-sm text-gray-400 mb-8">Session performance logs</p>

          <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
            {recentTrades.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-20">
                <ShieldCheck size={64} className="mb-4" />
                <p className="font-bold uppercase tracking-widest text-xs">Waiting for events</p>
              </div>
            ) : (
              recentTrades.map((trade) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={trade.id} 
                  className="bg-white/5 border border-white/5 p-5 rounded-2xl flex justify-between items-center group hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                      trade.direction === 'BUY' ? 'bg-[#00e676]/10 text-[#00e676]' : 'bg-red-500/10 text-red-500'
                    }`}>
                      <Activity size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-lg">{trade.pair}</p>
                      <p className="text-[10px] text-gray-500 font-mono uppercase tracking-tighter">
                        {trade.timeframe} • ${trade.stake} • {trade.direction}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono font-bold ${trade.status === 'WIN' ? 'text-[#00e676]' : trade.status === 'LOSS' ? 'text-red-500' : 'text-[#00bfff]'}`}>
                      {trade.status}
                    </p>
                    <p className="text-[10px] text-gray-500 font-mono mt-1 opacity-50">{trade.time}</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* System Diagnostics & Logs */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <div className="lg:col-span-2 bg-[#0b0e14]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold flex items-center gap-3">
              <Terminal size={22} className="text-[#00e676]" /> 
              <span>Engine Output</span>
            </h3>
            <button 
              onClick={() => setLogs([])}
              className="text-xs text-gray-500 hover:text-white transition-colors bg-white/5 px-3 py-1 rounded-full border border-white/10"
            >
              Flush Console
            </button>
          </div>
          <div className="bg-black/40 border border-white/5 rounded-2xl p-6 h-72 overflow-y-auto font-mono text-[11px] space-y-2 custom-scrollbar">
            {logs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-600 italic">
                <Activity className="animate-pulse mr-2" size={14} />
                Awaiting system activity...
              </div>
            ) : (
              logs.map((log, i) => (
                <motion.p 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i} 
                  className={`border-l-2 pl-3 py-0.5 ${
                    log.includes('Executing') ? 'text-[#00bfff] border-[#00bfff]' : 
                    log.includes('Success') || log.includes('synchronized') ? 'text-[#00e676] border-[#00e676]' : 
                    log.includes('Error') || log.includes('Warning') ? 'text-red-400 border-red-400' : 
                    'text-gray-400 border-gray-700'
                  }`}
                >
                  {log}
                </motion.p>
              ))
            )}
          </div>
        </div>

        <div className="bg-[#0b0e14]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
              <Signal size={22} className="text-[#00bfff]" />
              <span>Connectivity</span>
            </h3>
            <div className="space-y-4">
              {[
                { label: 'Signal Stream', status: isWsConnected ? 'CONNECTED' : 'OFFLINE', active: isWsConnected },
                { label: 'API Gateway', status: testResult?.includes('Success') ? 'STABLE' : 'CONNECTING', active: testResult?.includes('Success') },
                { label: 'Account Sync', status: balance !== null ? 'SYNCED' : 'PENDING', active: balance !== null }
              ].map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                  <span className="text-sm text-gray-300 font-medium">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${item.active ? 'bg-[#00e676]' : 'bg-red-500'}`}></div>
                    <span className={`text-[10px] font-bold tracking-wider ${item.active ? 'text-[#00e676]' : 'text-red-400'}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="pt-6 border-t border-white/10 mt-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00e676] to-[#00bfff] flex items-center justify-center text-[#0b0e14] font-bold">
                {email[0].toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-[10px] text-gray-500 uppercase tracking-tighter">Verified Trader</p>
                <p className="text-sm font-semibold text-white truncate">{email}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

    </div>
  );
};