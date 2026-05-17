'use client';

import React, { useState } from 'react';
import {
  Bot, Play, Square, ShieldCheck, User,
  Lock, Activity, Percent, TrendingUp, AlertCircle
} from 'lucide-react';

export default function Dashboard() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [isBotRunning, setIsBotRunning] = useState(false);
  const [tradeStatus, setTradeStatus] = useState('Ready to begin automated trade execution');

  const handleConnectBroker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    setError('');
    setTradeStatus('Authenticating with broker...');

    try {
      const loginRes = await fetch('https://tradingstudio-backend-production.up.railway.app/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
          accountType: 'demo'
        }),
      });

      const loginData = await loginRes.json();

      if (!loginRes.ok) {
        throw new Error(loginData.error || 'Authentication Failed.');
      }

      const currentToken = loginData.jwt;
      setToken(currentToken);
      setTradeStatus('Token acquired. Fetching live balance...');

      const balanceRes = await fetch('https://tradingstudio-backend-production.up.railway.app/api/balance?type=demo', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + currentToken }
      });

      const balanceData = await balanceRes.json();

      if (!balanceRes.ok) {
        throw new Error(balanceData.error || 'Failed to fetch balance.');
      }

      setBalance(balanceData.balance);
      setTradeStatus('Bridge active. Standing by.');

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Connection timeout.';
      console.error(errMsg);
      setError(errMsg);
      setTradeStatus('Connection failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBot = async () => {
    if (!token) {
      setError('Please sync your account first!');
      return;
    }

    if (isBotRunning) {
      setIsBotRunning(false);
      setTradeStatus('Engine Standby. Loop terminated.');
      return;
    }

    setIsBotRunning(true);
    setTradeStatus('Executing $1 CALL on open market...');

    try {
      const tradeRes = await fetch('https://tradingstudio-backend-production.up.railway.app/api/trade/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          pair: 'EURUSD-OTC',
          direction: 'CALL',
          amount: 1,
          accountType: 'demo'
        })
      });

      const tradeData = await tradeRes.json();

      if (!tradeRes.ok) {
        throw new Error(tradeData.error || 'Trade rejected by broker.');
      }

      setTradeStatus('Success! Trade Confirmed.');

      const refreshRes = await fetch('https://tradingstudio-backend-production.up.railway.app/api/balance?type=demo', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token }
      });

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
    <div className="min-h-screen bg-[#0b0e14] text-white font-sans p-6 selection:bg-[#00e676] selection:text-black">
      <header className="flex items-center justify-between max-w-7xl mx-auto w-full mb-8 pb-4 border-b border-[#1e2330]">
        <div className="flex items-center gap-2">
          <Bot className="text-[#00e676] w-7 h-7" />
          <span className="text-xl font-black tracking-tight uppercase">TradingStudio</span>
        </div>
        <div className="text-xs text-gray-500 font-mono flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00e676] animate-pulse"></span>
          SYS LINK ACTIVE : CLOUD
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-[#131823] border border-[#1e2330] rounded-2xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#00e676]" /> Account Sync
            </h3>

            <form onSubmit={handleConnectBroker} className="space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-3.5 text-gray-600" size={16} />
                <input
                  type="email"
                  placeholder="IQ Option Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#1c2230] border border-[#2a3142] rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#00e676]"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-3.5 text-gray-600" size={16} />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#1c2230] border border-[#2a3142] rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#00e676]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#00e676] text-black font-bold py-3 rounded-xl hover:bg-[#00c566] text-sm disabled:opacity-50"
              >
                {loading ? 'Synchronizing...' : 'Sync Account Balance'}
              </button>
            </form>

            {error && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="bg-[#131823] border border-[#1e2330] rounded-2xl p-5 text-xs text-gray-400">
            <h4 className="font-bold text-white mb-2 uppercase tracking-wide">Core Config</h4>
            <p className="leading-relaxed mb-4">Risk constraints locked for practice networks.</p>
            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="bg-[#1c2230] p-3 rounded-xl border border-[#2a3142]">
                <div className="text-gray-600 font-bold text-[10px]">BASE SIZE</div>
                <div className="text-white text-sm font-bold mt-0.5">$1.00</div>
              </div>
              <div className="bg-[#1c2230] p-3 rounded-xl border border-[#2a3142]">
                <div className="text-gray-600 font-bold text-[10px]">TIME WINDOW</div>
                <div className="text-white text-sm font-bold mt-0.5">1 MINUTE</div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#131823] border border-[#1e2330] rounded-2xl p-6 flex flex-col justify-between min-h-[400px]">
            <div className="flex items-center justify-between border-b border-[#1e2330] pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${isBotRunning ? 'bg-[#00e676] animate-pulse' : 'bg-red-500'}`}></span>
                  <span className="text-sm font-bold uppercase tracking-wide text-white">
                    {isBotRunning ? 'Engine Running' : 'Engine Standby'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2 font-mono">{tradeStatus}</p>
              </div>

              <button
                disabled={balance === null || isBotRunning}
                onClick={handleToggleBot}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 ${balance === null
                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-[#00e676] text-black hover:bg-[#00c566]'
                  }`}
              >
                {!isBotRunning ? (
                  <>
                    <Play size={12} fill="currentColor" /> Initiate Bot
                  </>
                ) : (
                  <>
                    <Square size={12} fill="currentColor" /> Processing...
                  </>
                )}
              </button>
            </div>

            <div className="my-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="md:col-span-1 border-r border-[#1e2330] pr-4">
                <span className="text-xs text-gray-500 uppercase tracking-wider block font-bold">Available Balance</span>
                <h1 className="text-4xl md:text-5xl font-black font-mono tracking-tight text-white mt-1">
                  {balance !== null ? `$${balance.toLocaleString()}` : '$0'}
                </h1>
              </div>

              <div className="md:col-span-2 grid grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-[#1c2230] p-3 rounded-xl border border-[#2a3142]">
                  <Activity size={14} className="mx-auto text-[#00e676] mb-1" />
                  <span className="block font-mono text-white text-sm font-bold">0</span>
                  <span className="text-[10px] text-gray-500 font-bold uppercase">Wins</span>
                </div>
                <div className="bg-[#1c2230] p-3 rounded-xl border border-[#2a3142]">
                  <Activity size={14} className="mx-auto text-red-500 mb-1" />
                  <span className="block font-mono text-white text-sm font-bold">0</span>
                  <span className="text-[10px] text-gray-500 font-bold uppercase">Losses</span>
                </div>
                <div className="bg-[#1c2230] p-3 rounded-xl border border-[#2a3142]">
                  <TrendingUp size={14} className="mx-auto text-gray-400 mb-1" />
                  <span className="block font-mono text-white text-sm font-bold">$0.00</span>
                  <span className="text-[10px] text-gray-500 font-bold uppercase">Profit</span>
                </div>
                <div className="bg-[#1c2230] p-3 rounded-xl border border-[#2a3142]">
                  <Percent size={14} className="mx-auto text-blue-400 mb-1" />
                  <span className="block font-mono text-white text-sm font-bold">0%</span>
                  <span className="text-[10px] text-gray-500 font-bold uppercase">Win Rate</span>
                </div>
              </div>
            </div>

            <div className="border-t border-[#1e2330] pt-4 flex justify-between items-center text-[11px] font-mono text-gray-500">
              <span>DAILY CAPACITY UTILIZATION:</span>
              <span className="text-white font-bold">0 / 50 TRADES</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
