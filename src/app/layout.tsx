import React from 'react';
import './globals.css';
import { LayoutDashboard, Cpu, History, LogOut } from 'lucide-react';

export const metadata = {
  title: 'TradingStudio Console',
  description: 'Premium Automated Execution Interface',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#080b11] text-[#f3f4f6] font-sans min-h-screen flex selection:bg-[#00e676] selection:text-black">
        
        {/* Sleek, Premium Side Panel Menu Wrapper */}
        <aside className="w-64 bg-[#0d121f] border-r border-[#1a2236] flex flex-col justify-between p-6 shrink-0 z-10">
          <div className="space-y-8">
            
            {/* Branding Indicator */}
            <div className="flex items-center gap-3 pl-2">
              <div className="w-3 h-3 rounded-full bg-[#00e676] shadow-[0_0_12px_#00e676]" />
              <span className="text-sm font-black tracking-widest uppercase text-white font-mono">
                TRADINGSTUDIO
              </span>
            </div>

            {/* Multi-Page Navigation Route Options */}
            <nav className="space-y-1">
              <a 
                href="/dashboard" 
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-400 hover:text-[#00e676] hover:bg-[#131b2e] rounded-xl transition-all duration-200"
              >
                <LayoutDashboard size={18} />
                <span>Console Overview</span>
              </a>
              <a 
                href="/engine" 
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-400 hover:text-[#00e676] hover:bg-[#131b2e] rounded-xl transition-all duration-200"
              >
                <Cpu size={18} />
                <span>Automation Core</span>
              </a>
              <a 
                href="/history" 
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-400 hover:text-[#00e676] hover:bg-[#131b2e] rounded-xl transition-all duration-200"
              >
                <History size={18} />
                <span>Execution Logs</span>
              </a>
            </nav>
          </div>

          {/* Core Access Disconnection */}
          <div className="pt-4 border-t border-[#1a2236]">
            <button 
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-500 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all duration-200"
            >
              <LogOut size={18} />
              <span>Disconnect Link</span>
            </button>
          </div>
        </aside>

        {/* Core Screen View Workspace Frame */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 border-b border-[#1a2236] bg-[#0d121f]/50 backdrop-blur-md flex items-center justify-between px-8 z-0">
            <div className="text-xs font-mono text-gray-500 tracking-wider">
              NETWORK LINK STATUS : <span className="text-[#00e676] font-bold">SECURED CLOUD API</span>
            </div>
          </header>
          
          <main className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-6xl mx-auto w-full">
              {children}
            </div>
          </main>
        </div>

      </body>
    </html>
  );
}
