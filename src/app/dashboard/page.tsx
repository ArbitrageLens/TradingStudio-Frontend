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
                  className="w-full bg
