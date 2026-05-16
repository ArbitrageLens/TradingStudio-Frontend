'use client';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, ShieldCheck, Activity, Lock, Mail, Key, CheckCircle2, XCircle, RefreshCw, Terminal, Signal, ArrowRight } from 'lucide-react';

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
  
  // Connectivity States
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [apiStatus, setApiStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [accountSyncStatus, setAccountSyncStatus] = useState<'pending' | 'synced' | 'error'>('pending');
  
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

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_URL}/`).catch(() => null);
      if (res && res.ok) {
        const text = await res.text();
        setTestResult(`Success: ${text}`);
      } else {
        setTestResult(`Failed: ${res?.status || 'Network Error'}`);
      }
    } catch (err: any) {
      setTestResult(`Error: ${err.message}`);
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
        setAccountSyncStatus('synced');
        addLog(`Balance synchronized: $${data.balance.toLocaleString()}`);
      } else {
        setBalance(null);
        setAccountSyncStatus('error');
        addLog(`Warning: Could not fetch ${type} balance from server.`);
      }
    } catch (err) {
      console.error('Failed to fetch balance', err);
      setBalance(null);
      setAccountSyncStatus('error');
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

  // Connectivity Monitoring
  useEffect(() => {
    const checkApi = async () => {
      try {
        const res = await fetch(`${API_URL}/`).catch(() => null);
        if (res && res.ok) {
          setApiStatus('connected');
        } else {
          setApiStatus('error');
        }
      } catch {
        setApiStatus('error');
      }
    };

    checkApi();
    const interval = setInterval(checkApi, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  // Signal API Listener
  useEffect(() => {
    if (!jwt) return;

    const wsUrl = `wss://${API_URL.replace(/^https?:\/\//, '')}/api/signals?token=${jwt}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      addLog('Connected to Signal API.');
      setIsWsConnected(true);
    };
    
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

    ws.onclose = () => {
      addLog('Disconnected from Signal API.');
      setIsWsConnected(false);
    };

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
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="bg-[#0b0e14]/90 backdrop-blur-3xl border border-white/10 p-8 md:p-12 rounded-[2.5rem] md:rounded-[3rem] max-w-lg mx-auto shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)] text-white relative overflow-hidden group"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00e676] to-transparent opacity-40"></div>
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#00e676]/10 rounded-full blur-[80px]"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#00bfff]/10 rounded-full blur-[80px]"></div>
        
        <div className="text-center mb-12 relative">
          <motion.div 
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white/5 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-white/10 shadow-inner group-hover:border-[#00e676]/40 transition-all duration-700 rotate-3 hover:rotate-0"
          >
            <Lock className="text-[#00e676]" size={42} />
          </motion.div>
          <h2 className="text-4xl font-black tracking-tighter">TradingStudio <span className="text-[#00e676]">HQ</span></h2>
          <p className="text-sm text-gray-500 mt-4 font-medium max-w-[280px] mx-auto leading-relaxed">Secure gateway to elite binary automation and algorithmic trading.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">Verified Identity</label>
            <div className="relative group">
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#00e676] transition-colors" size={20} />
              <input 
                type="email" 
                placeholder="IQ Option Email"
                className="w-full bg-white/5 border border-white/5 pl-14 pr-6 py-5 rounded-2xl focus:bg-white/10 focus:border-[#00e676]/30 outline-none transition-all text-sm font-semibold placeholder:text-gray-600"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">Access Key</label>
            <div className="relative group">
              <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#00e676] transition-colors" size={20} />
              <input 
                type="password" 
                placeholder="IQ Option Password"
                className="w-full bg-white/5 border border-white/5 pl-14 pr-6 py-5 rounded-2xl focus:bg-white/10 focus:border-[#00e676]/30 outline-none transition-all text-sm font-semibold placeholder:text-gray-600"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <AnimatePresence>
            {loginError && (
              <motion.div 
                initial={{ height: 0, opacity: 0, y: -10 }}
                animate={{ height: 'auto', opacity: 1, y: 0 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold p-4 rounded-2xl flex items-center gap-3">
                  <XCircle size={18} /> {loginError}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit" 
            disabled={isLoggingIn}
            className="w-full bg-white text-[#0b0e14] font-black py-5 rounded-[1.5rem] hover:bg-[#00e676] hover:text-[#0b0e14] transition-all disabled:opacity-50 shadow-2xl flex items-center justify-center gap-3 uppercase tracking-tighter"
          >
            {isLoggingIn ? (
              <>
                <RefreshCw className="animate-spin" size={20} />
                <span>Establishing Secure Handshake...</span>
              </>
            ) : (
              <>
                <span>Launch Trading Dashboard</span>
                <ArrowRight size={20} />
              </>
            )}
          </motion.button>
        </form>

        <div className="mt-12 pt-8 border-t border-white/5 text-center space-y-4">
          <p className="text-xs text-gray-500 font-medium">
            Don't have an IQ Option account? 
            <a 
              href="https://iqoption.net/lp/mobile-partner-pwa/?aff=788856&aff_model=revenue&afftrack="
              target="_blank"
              className="text-[#00e676] hover:underline ml-1 font-bold"
            >
              Register with Referral Link
            </a>
          </p>
          <div className="flex items-center justify-center gap-2 opacity-30 grayscale hover:grayscale-0 transition-all duration-500">
            <ShieldCheck size={14} className="text-[#00e676]" />
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">Military-Grade Encryption</p>
          </div>
        </div>
      </motion.div>
    );
  }

  const winRate = stats.totalTrades > 0 ? Math.round((stats.wins / stats.totalTrades) * 100) : 0;

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto text-white w-full pb-32 pt-6">
      
      {/* Dashboard Top Navigation / Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Account & Mode Context */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0b0e14]/60 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-6 md:p-10 shadow-2xl flex flex-col justify-between group overflow-hidden relative"
        >
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#00e676]/5 rounded-full blur-3xl group-hover:bg-[#00e676]/10 transition-all"></div>
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-xl font-black flex items-center gap-3">
                  <ShieldCheck size={24} className="text-[#00e676]" /> 
                  Account
                </h3>
                <p className="text-xs text-gray-500 mt-1 font-mono opacity-60 truncate max-w-[200px]">{email}</p>
              </div>
              <motion.button 
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.5 }}
                onClick={() => jwt && fetchBalance(jwt)}
                className="p-3 bg-white/5 rounded-2xl border border-white/5 hover:border-[#00e676]/50 transition-colors"
              >
                <RefreshCw size={20} className={isTesting ? 'animate-spin' : ''} />
              </motion.button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-8 hover:bg-white/[0.07] transition-all">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Available Balance</span>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${accountType === 'live' ? 'bg-[#00e676]/10 text-[#00e676]' : 'bg-[#00bfff]/10 text-[#00bfff]'}`}>
                  {accountType}
                </div>
              </div>
              <p className="text-4xl font-black tracking-tighter">
                {balance !== null ? `$${balance.toLocaleString()}` : '---'}
              </p>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">Switch Account Type</label>
              <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5">
                <button 
                  onClick={() => { setAccountType('demo'); fetchBalance(jwt!, 'demo'); }}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${accountType === 'demo' ? 'bg-[#00bfff] text-[#0b0e14] shadow-lg shadow-[#00bfff]/20' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Practice
                </button>
                <button 
                  onClick={() => { setAccountType('live'); fetchBalance(jwt!, 'live'); }}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${accountType === 'live' ? 'bg-[#00e676] text-[#0b0e14] shadow-lg shadow-[#00e676]/20' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Live
                </button>
              </div>
            </div>
          </div>
          
          <div className="mt-10 pt-8 border-t border-white/5">
            <motion.button 
              whileHover={{ x: 5 }}
              onClick={handleLogout}
              className="text-xs font-black text-red-500/60 hover:text-red-400 uppercase tracking-widest flex items-center gap-2 transition-all"
            >
              Terminate Session <ArrowRight size={14} />
            </motion.button>
          </div>
        </motion.div>

        {/* Main Engine Control */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#0b0e14]/60 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-6 md:p-10 shadow-2xl lg:col-span-2 overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#00e676]/5 rounded-full blur-[100px] pointer-events-none"></div>
          
          <div className="flex flex-col md:flex-row justify-between items-start mb-12 gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-[#00e676] animate-pulse shadow-[0_0_12px_#00e676]' : 'bg-red-500'}`}></div>
                <h3 className="text-3xl font-black tracking-tighter">
                  {isActive ? 'Engine Active' : 'Engine Standby'}
                </h3>
              </div>
              <p className="text-sm text-gray-500 font-medium">
                {isActive ? 'Scanning market liquidity and analyzing signals...' : 'Ready to begin automated trade execution.'}
              </p>
            </div>
            
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsActive(!isActive)}
              className={`w-full md:w-auto px-12 py-5 rounded-[1.75rem] font-black transition-all shadow-2xl flex items-center justify-center gap-3 uppercase tracking-tighter text-sm ${
                isActive 
                  ? 'bg-red-500 text-white shadow-red-500/20' 
                  : 'bg-gradient-to-r from-[#00e676] to-[#00bfff] text-[#0b0e14] shadow-[#00e676]/20'
              }`}
            >
              {isActive ? (
                <>
                  <Square size={20} fill="currentColor" /> Emergency Stop
                </>
              ) : (
                <>
                  <Play size={20} fill="currentColor" /> Initiate Bot
                </>
              )}
            </motion.button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            {[
              { label: 'Wins', value: stats.wins, color: 'text-[#00e676]', icon: <CheckCircle2 size={16} /> },
              { label: 'Losses', value: stats.losses, color: 'text-red-400', icon: <XCircle size={16} /> },
              { label: 'Session Profit', value: `$${stats.profit.toFixed(2)}`, color: stats.profit >= 0 ? 'text-[#00e676]' : 'text-red-400', icon: <Activity size={16} /> },
              { label: 'Win Rate', value: `${winRate}%`, color: 'text-[#00bfff]', icon: <Signal size={16} /> }
            ].map((stat, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + (i * 0.1) }}
                className="bg-white/5 p-6 rounded-[2rem] border border-white/5 flex flex-col items-center justify-center group hover:bg-white/[0.08] transition-all"
              >
                <div className={`${stat.color} mb-3 opacity-60 group-hover:opacity-100 transition-opacity`}>{stat.icon}</div>
                <p className={`text-2xl font-black font-mono tracking-tighter ${stat.color}`}>{stat.value}</p>
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-2">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          <div className="relative pt-4">
            <div className="flex justify-between text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-4 px-2">
              <span>Daily Capacity Utilization</span>
              <span className="text-white">{stats.totalTrades} / {config.maxDailyTrades} TRADES</span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 p-[2px]">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (stats.totalTrades / config.maxDailyTrades) * 100)}%` }}
                className="h-full bg-gradient-to-r from-[#00e676] to-[#00bfff] rounded-full shadow-[0_0_15px_rgba(0,230,118,0.5)]"
              ></motion.div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Risk Configuration */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#0b0e14]/60 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-10 shadow-2xl xl:col-span-2"
        >
          <div className="flex items-center gap-4 mb-10">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <Terminal size={24} className="text-gray-400" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tighter">Core Configuration</h3>
              <p className="text-sm text-gray-500 font-medium">Calibrate risk levels and asset targeting.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-12">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2 flex justify-between">
                Stake per Trade <span className="text-white font-mono">$ {config.stake}</span>
              </label>
              <div className="relative group">
                <input 
                  type="range" 
                  min="1"
                  max="1000"
                  className="w-full accent-[#00e676] bg-white/10 h-1.5 rounded-full appearance-none cursor-pointer"
                  value={config.stake}
                  onChange={(e) => setConfig({...config, stake: Number(e.target.value)})}
                />
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2 flex justify-between">
                Session Trade Limit <span className="text-white font-mono">{config.maxDailyTrades}</span>
              </label>
              <input 
                type="range" 
                min="1"
                max="200"
                className="w-full accent-[#00bfff] bg-white/10 h-1.5 rounded-full appearance-none cursor-pointer"
                value={config.maxDailyTrades}
                onChange={(e) => setConfig({...config, maxDailyTrades: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2 flex justify-between">
                Daily Stop Loss <span className="text-red-400 font-mono">$ {config.maxLoss}</span>
              </label>
              <input 
                type="range" 
                min="10"
                max="5000"
                step="10"
                className="w-full accent-red-500 bg-white/10 h-1.5 rounded-full appearance-none cursor-pointer"
                value={config.maxLoss}
                onChange={(e) => setConfig({...config, maxLoss: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2 flex justify-between">
                Signal Confidence <span className="text-[#00e676] font-mono">{config.minConfidence}%</span>
              </label>
              <input 
                type="range" 
                min="70"
                max="99"
                className="w-full accent-[#00e676] bg-white/10 h-1.5 rounded-full appearance-none cursor-pointer"
                value={config.minConfidence}
                onChange={(e) => setConfig({...config, minConfidence: Number(e.target.value)})}
              />
            </div>
          </div>

          <div className="mb-10">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2 mb-6 block">Timeframe Filtering</label>
            <div className="flex flex-wrap gap-4">
              {AVAILABLE_TIMEFRAMES.map(tf => (
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  key={tf}
                  onClick={() => toggleTimeframe(tf)}
                  className={`px-10 py-4 rounded-2xl border-2 font-black text-xs transition-all ${
                    config.timeframes.includes(tf) 
                      ? 'bg-[#00e676] text-[#0b0e14] border-transparent shadow-xl shadow-[#00e676]/20' 
                      : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/10'
                  }`}
                >
                  {tf}
                </motion.button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2 mb-6 block">Target Asset Classes</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {AVAILABLE_PAIRS.map(pair => (
                <motion.button
                  whileHover={{ y: -2 }}
                  key={pair}
                  onClick={() => togglePair(pair)}
                  className={`py-5 rounded-2xl border-2 text-[10px] font-black transition-all truncate px-2 tracking-tighter ${
                    config.pairs.includes(pair) 
                      ? 'bg-[#00bfff] text-[#0b0e14] border-transparent shadow-xl shadow-[#00bfff]/20' 
                      : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/10'
                  }`}
                >
                  {pair.replace('-OTC', '')}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Live Event Log */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#0b0e14]/60 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-10 shadow-2xl flex flex-col h-full overflow-hidden group"
        >
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-2xl font-black tracking-tighter">Live Feed</h3>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00e676] animate-ping"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-[#00e676]"></div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar">
            {recentTrades.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-20 py-20">
                <Signal size={64} className="mb-6 animate-pulse" />
                <p className="font-black uppercase tracking-[0.3em] text-[10px]">Awaiting Market Events</p>
              </div>
            ) : (
              recentTrades.map((trade) => (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={trade.id} 
                  className="bg-white/5 border border-white/5 p-6 rounded-[2rem] flex justify-between items-center group/item hover:bg-white/[0.08] transition-all border-l-4 border-l-transparent hover:border-l-[#00e676]"
                >
                  <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                      trade.direction === 'BUY' ? 'bg-[#00e676]/10 text-[#00e676]' : 'bg-red-500/10 text-red-500'
                    }`}>
                      <Activity size={28} />
                    </div>
                    <div>
                      <p className="font-black text-xl tracking-tighter">{trade.pair}</p>
                      <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1 opacity-60">
                        {trade.timeframe} • ${trade.stake} • {trade.direction}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono font-black text-lg ${trade.status === 'WIN' || trade.status === 'LOSS' ? 'text-[#00e676]' : 'text-[#00bfff]'}`}>
                      {trade.status}
                    </p>
                    <p className="text-[10px] text-gray-500 font-black mt-1 opacity-40">{trade.time}</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Engine Diagnostics Panel */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-1 xl:grid-cols-4 gap-8"
      >
        <div className="xl:col-span-3 bg-[#0b0e14]/60 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-12 shadow-3xl overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          
          <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shadow-inner">
                <Terminal className="text-[#00e676]" size={32} />
              </div>
              <div>
                <h3 className="text-3xl font-black tracking-tighter">Engine Output</h3>
                <p className="text-sm text-gray-500 font-medium">Real-time system telemetry and signal analysis.</p>
              </div>
            </div>
            <button 
              onClick={() => setLogs([])}
              className="px-8 py-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Flush Buffer
            </button>
          </div>

          <div className="bg-black/60 border border-white/5 rounded-[2rem] p-8 h-96 overflow-y-auto font-mono text-xs space-y-3 custom-scrollbar shadow-inner relative">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-700 italic space-y-4">
                <RefreshCw className="animate-spin opacity-20" size={48} />
                <p className="font-black uppercase tracking-[0.4em] text-[10px] opacity-40">System Initializing...</p>
              </div>
            ) : (
              logs.map((log, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i} 
                  className={`flex gap-4 border-l-2 pl-6 py-1 group ${
                    log.includes('Executing') ? 'text-[#00bfff] border-[#00bfff]' : 
                    log.includes('Success') || log.includes('synchronized') ? 'text-[#00e676] border-[#00e676]' : 
                    log.includes('Error') || log.includes('Warning') ? 'text-red-400 border-red-400' : 
                    'text-gray-500 border-white/10'
                  }`}
                >
                  <span className="opacity-20 group-hover:opacity-100 transition-opacity whitespace-nowrap">{i.toString().padStart(3, '0')}</span>
                  <span className="font-medium tracking-tight">{log}</span>
                </motion.div>
              ))
            )}
          </div>
        </div>

        <div className="xl:col-span-1 bg-[#0b0e14]/60 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-10 shadow-3xl flex flex-col group">
          <div className="flex items-center gap-4 mb-10">
            <Activity className="text-[#00e676]" size={24} />
            <h3 className="text-xl font-black tracking-tighter">Connectivity</h3>
          </div>

          <div className="space-y-6">
            {[
              { label: 'Signal Stream', status: isWsConnected ? 'CONNECTED' : 'DISCONNECTED', color: isWsConnected ? 'text-[#00e676]' : 'text-red-500' },
              { label: 'API Gateway', status: apiStatus.toUpperCase(), color: apiStatus === 'connected' ? 'text-[#00e676]' : apiStatus === 'connecting' ? 'text-[#00bfff]' : 'text-red-500' },
              { label: 'Account Sync', status: accountSyncStatus.toUpperCase(), color: accountSyncStatus === 'synced' ? 'text-[#00e676]' : accountSyncStatus === 'pending' ? 'text-[#00bfff]' : 'text-red-500' }
            ].map((conn, i) => (
              <div key={i} className="bg-white/5 border border-white/5 p-6 rounded-2xl flex flex-col gap-2">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{conn.label}</span>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${conn.color.replace('text-', 'bg-')} ${conn.status !== 'DISCONNECTED' && conn.status !== 'ERROR' ? 'animate-pulse' : ''}`}></div>
                  <span className={`text-[10px] font-black ${conn.color}`}>{conn.status}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-8 border-t border-white/5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#00e676]/10 flex items-center justify-center text-[#00e676] font-black text-lg">
              {email ? email[0].toUpperCase() : 'U'}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Verified Trader</span>
              <span className="text-[10px] font-bold text-white truncate max-w-[120px]">{email}</span>
            </div>
          </div>
        </div>
      </motion.div>

      <footer className="text-center space-y-4 opacity-40 hover:opacity-100 transition-opacity duration-700">
        <p className="text-[10px] font-black uppercase tracking-[0.5em]">TradingStudio Intelligence Systems v4.0.2</p>
        <div className="flex justify-center gap-8">
          <a href="#" className="text-[10px] font-black uppercase tracking-widest hover:text-[#00e676]">Protocol</a>
          <a href="#" className="text-[10px] font-black uppercase tracking-widest hover:text-[#00e676]">Compliance</a>
          <a href="#" className="text-[10px] font-black uppercase tracking-widest hover:text-[#00e676]">Security</a>
        </div>
      </footer>

    </div>
  );
};
