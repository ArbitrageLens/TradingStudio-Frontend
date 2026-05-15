'use client';
import React, { useState, useEffect } from 'react';
import { Play, Square, ShieldCheck, Activity } from 'lucide-react';

export const AutoBotController = () => {
  const [isActive, setIsActive] = useState(false);
  const [config, setConfig] = useState({
    stake: 10,
    maxLoss: 50,
    profitTarget: 100,
    pair: 'EURUSD-OTC'
  });

  return (
    <div className="bg-studio-card border border-studio-border p-6 rounded-2xl">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Activity className="text-studio-accent" /> AI Execution Engine
        </h3>
        <button 
          onClick={() => setIsActive(!isActive)}
          className={`px-6 py-2 rounded-full font-bold flex items-center gap-2 transition ${
            isActive ? 'bg-studio-danger text-white' : 'bg-studio-accent text-black'
          }`}
        >
          {isActive ? <><Square size={18}/> Stop Bot</> : <><Play size={18}/> Start Auto-Trade</>}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <label className="text-xs text-white/40 uppercase">Stake Amount ($)</label>
          <input 
            type="number" 
            className="w-full bg-studio-bg border border-studio-border p-2 rounded-lg focus:border-studio-accent outline-none"
            value={config.stake}
            onChange={(e) => setConfig({...config, stake: Number(e.target.value)})}
          />
        </div>
        {/* Repeat for Max Loss and Profit Target */}
        <div className="space-y-2">
          <label className="text-xs text-white/40 uppercase">Daily Stop Loss ($)</label>
          <input type="number" className="w-full bg-studio-bg border border-studio-border p-2 rounded-lg" value={config.maxLoss} />
        </div>
        <div className="space-y-2">
          <label className="text-xs text-white/40 uppercase">Profit Target ($)</label>
          <input type="number" className="w-full bg-studio-bg border border-studio-border p-2 rounded-lg" value={config.profitTarget} />
        </div>
        <div className="space-y-2">
          <label className="text-xs text-white/40 uppercase">Preferred Asset</label>
          <select className="w-full bg-studio-bg border border-studio-border p-2 rounded-lg">
            <option>EURUSD-OTC</option>
            <option>GBPUSD-OTC</option>
          </select>
        </div>
      </div>

      {isActive && (
        <div className="mt-6 p-3 bg-studio-accent/10 border border-studio-accent/20 rounded-lg animate-pulse flex items-center gap-3">
          <ShieldCheck className="text-studio-accent" />
          <span className="text-sm text-studio-accent font-mono">Engine Live: Scanning market for {config.pair} signals...</span>
        </div>
      )}
    </div>
  );
};
