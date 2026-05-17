'use client';

import React, { useState } from 'react';
import {
  Bot, Play, Square, ShieldCheck, User, Lock, 
  Activity, Percent, TrendingUp, AlertCircle, 
  LayoutDashboard, Cpu, History, LogOut, ChevronRight
} from 'lucide-react';

export default function Dashboard() {
  // Public SaaS User State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Engine State
  const [balance, setBalance] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [tradeStatus, setTradeStatus] = useState('Awaiting user authentication and engine link.');

  const handleConnectBroker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    setError('');
    setTradeStatus('Establishing secure connection to broker...');

    try {
      const loginRes = await fetch('https://tradingstudio-backend-production.up.railway.app/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim(), accountType: 'demo' }),
      });

      const loginData = await loginRes.json();
      if (!loginRes.ok) throw new Error(loginData.error || 'Authentication Failed.');

      const currentToken = loginData.jwt;
      setToken(currentToken);
      setTradeStatus('Token acquired. Syncing live liquidity...');

      const balanceRes = await fetch(
        'https://tradingstudio-backend-production.up.railway.app/api/balance?type=demo', 
        { method: 'GET', headers: { 'Authorization': 'Bearer ' + currentToken } }
      );

      const balanceData = await balanceRes.json();
      if (!balanceRes.ok) throw new Error(balanceData.error || 'Failed to fetch balance.');

      setBalance(balanceData.balance);
      setTradeStatus('Bridge active. Standing by for execution commands.');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Connection timeout.';
      console.error(errMsg);
      setError(errMsg);
      setTradeStatus('Connection failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBot = async () => {
    if (!token) {
      setError('Please connect an account first.');
      return;
    }

    if (isBotRunning) {
      setIsBotRunning(false);
      setTradeStatus('Engine Standby. Automated loop terminated.');
      return;
    }

    setIsBotRunning(true);
    setTradeStatus('Executing protocol: $1 CALL on open market...');

    try {
      const tradeRes = await fetch(
        'https://tradingstudio-backend-production.up.railway.app/api/trade/execute', 
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ pair: 'EURUSD-OTC', direction: 'CALL', amount: 1, accountType: 'demo' })
        }
      );

      const tradeData = await tradeRes.json();
      if (!tradeRes.ok) throw new Error(tradeData.error || 'Trade rejected by broker.');

      setTradeStatus(`Success! Trade Confirmed. ID: ${tradeData.tradeId || 'Verified'}`);

      const refreshRes = await fetch(
        'https://tradingstudio-backend-production.up.railway.app/api/balance?type=demo', 
        { method: 'GET', headers: { 'Authorization': 'Bearer ' + token } }
      );

      if (refreshRes.ok) {
        const bData = await refreshRes.json();
        setBalance(bData.balance);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Trade failed.';
      console.error(errMsg);
      setError(errMsg);
      setTradeStatus('Execution Error. Check Logs.');
    } finally {
      setIsBotRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-gray-300 font-sans flex selection:bg-[#00e676] selection:text-black">
      
      {/* Premium Sidebar Navigation */}
      <aside className="w-72 bg-[#080808] border-r border-white/5 flex flex-col justify-between hidden md:flex z-10 relative">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#00e676]/5 to-transparent pointer-events-none" />
        <div className="p-8 space-y-10">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[#00e676] shadow-[0_0_15px_rgba(0,230,118,0.6)] animate-pulse" />
            <span className="text-lg font-black tracking-widest text-white">TRADINGSTUDIO</span>
          </div>

          <nav className="space-y-2">
            <a href="#" className="flex items-center justify-between px-4 py-3 bg-white/5 text-white rounded-xl border border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.02)] transition-all">
              <div className="flex items-center gap-3">
                <LayoutDashboard size={18} className="text-[#00e676]" />
                <span className="text-sm font-semibold">Console</span>
              </div>
              <ChevronRight size={14} className="text-gray-500" />
            </a>
            <a href="#" className="flex items-center justify-between px-4 py-3 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all">
              <div className="flex items-center gap-3">
                <Cpu size={18} />
                <span className="text-sm font-medium">Algorithms</span>
              </div>
            </a>
            <a href="#" className="flex items-center justify-between px-4 py-3 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all">
              <div className="flex items-center gap-3">
                <History size={18} />
                <span className="text-sm font-medium">History</span>
              </div>
            </a>
          </nav>
        </div>

        <div className="p-8 border-t border-white/5">
          <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
            <LogOut size={18} />
            <span>Disconnect</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-h-screen relative overflow-hidden">
        {/* Ambient Background Glow */}
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#00e676]/10 rounded-full blur-[120px] pointer-events-none" />

        <header className="h-20 border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl flex items-center justify-between px-8 z-10">
          <div>
            <h1 className="text-xl font-bold text-white">Execution Console</h1>
            <p className="text-xs text-gray-500 mt-1">Multi-Tenant Environment Active</p>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
            <span className="w-2 h-2 rounded-full bg-[#00e676]" />
            <span className="text-xs font-mono tracking-wider text-gray-300">API CONNECTED</span>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto z-10">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Multi-User Authentication */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00e676] to-transparent opacity-50" />
                
                <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-6 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-[#00e676]" /> Connect Account
                </h3>

                <form onSubmit={handleConnectBroker} className="space-y-4">
                  <div className="relative group">
                    <User className="absolute left-4 top-3.5 text-gray-500 group-focus-within:text-[#00e676] transition-colors" size={16} />
                    <input
                      type="email"
                      placeholder="IQ Option Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00e676]/50 focus:bg-white/10 transition-all"
                    />
                  </div>

                  <div className="relative group">
                    <Lock className="absolute left-4 top-3.5 text-gray-500 group-focus-within:text-[#00e676] transition-colors" size={16} />
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00e676]/50 focus:bg-white/10 transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#00e676] hover:bg-[#00ff88] text-black font-bold py-3.5 rounded-xl text-sm disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(0,230,118,0.2)] hover:shadow-[0_0_30px_rgba(0,230,118,0.4)]"
                  >
                    {loading ? 'Authenticating...' : 'Secure Connection'}
                  </button>
                </form>

                {error && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              {/* Bot Config */}
              <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 shadow-2xl">
                <h4 className="font-bold text-white mb-4 uppercase tracking-wider text-xs text-gray-400">Trading Parameters</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <div className="text-gray-500 font-bold text-[10px] tracking-wider mb-1">BASE STAKE</div>
                    <div className="text-white text-lg font-mono">$1.00</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <div className="text-gray-500 font-bold text-[10px] tracking-wider mb-1">TIMEFRAME</div>
                    <div className="text-white text-lg font-mono">1 MIN</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Execution Monitor */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-8 shadow-2xl flex flex-col justify-between min-h-[450px]">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-6">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className={`w-3 h-3 rounded-full ${isBotRunning ? 'bg-[#00e676] shadow-[0_0_10px_#00e676] animate-pulse' : 'bg-red-500'}`} />
                      <span className="text-sm font-bold uppercase tracking-widest text-white">
                        {isBotRunning ? 'Engine Active' : 'System Standby'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 font-mono">{tradeStatus}</p>
                  </div>

                  <button
                    disabled={balance === null || isBotRunning}
                    onClick={handleToggleBot}
                    className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
                      balance === null 
                        ? 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5'
                        : 'bg-white text-black hover:bg-gray-200 shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                    }`}
                  >
                    {!isBotRunning ? (
                      <><Play size={14} fill="currentColor" /> Initiate Bot</>
                    ) : (
                      <><Square size={14} fill="currentColor" /> Processing...</>
                    )}
                  </button>
                </div>

                {/* Big Balance Display */}
                <div className="py-8">
                  <span className="text-xs text-gray-500 uppercase tracking-widest font-bold block mb-2">Available Liquidity</span>
                  <h1 className="text-5xl md:text-7xl font-black font-mono tracking-tighter text-white">
                    {balance !== null ? `$${balance.toLocaleString('en-US', {minimumFractionDigits: 2})}` : '$0.00'}
                  </h1>
                </div>

                {/* Live Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <Activity size={16} className="text-[#00e676] mb-2" />
                    <span className="block font-mono text-white text-xl font-bold">0</span>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Wins</span>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <Activity size={16} className="text-red-500 mb-2" />
                    <span className="block font-mono text-white text-xl font-bold">0</span>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Losses</span>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <TrendingUp size={16} className="text-white mb-2" />
                    <span className="block font-mono text-[#00e676] text-xl font-bold">+$0.00</span>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Net Profit</span>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <Percent size={16} className="text-blue-400 mb-2" />
                    <span className="block font-mono text-white text-xl font-bold">0.0%</span>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Win Rate</span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
