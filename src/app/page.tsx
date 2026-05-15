import Link from 'next/link';
import { Bot, ArrowRight, UserPlus, PlayCircle, BarChart3, Shield, Users } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0b0e14] text-white font-sans selection:bg-[#00e676] selection:text-black flex flex-col">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto w-full border-b border-[#1e2330]">
        <div className="flex items-center gap-2">
          <Bot className="text-[#00e676] w-8 h-8" />
          <span className="text-xl font-bold tracking-tight">TradingStudio</span>
        </div>
        <div className="flex gap-4">
          <Link 
            href="/dashboard"
            className="hidden md:flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white transition"
          >
            Sign In
          </Link>
          <Link 
            href="https://iqoption.net/lp/mobile-partner-pwa/?aff=788856&aff_model=revenue&afftrack="
            target="_blank"
            className="flex items-center gap-2 text-sm font-semibold bg-[#00e676]/10 text-[#00e676] px-4 py-2 rounded-xl border border-[#00e676]/30 hover:bg-[#00e676]/20 transition"
          >
            <UserPlus size={16} /> Create Account
          </Link>
        </div>
      </nav>

      {/* Hero Section (Chatbot Style) */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 mt-10 md:mt-20 max-w-5xl mx-auto w-full">
        
        {/* Chat UI Mockup */}
        <div className="w-full max-w-2xl bg-[#131823] border border-[#1e2330] rounded-3xl p-6 shadow-2xl mb-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00e676] to-[#00bfff]"></div>
          
          <div className="flex gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#00e676]/20 flex items-center justify-center flex-shrink-0 border border-[#00e676]/30">
              <Bot className="text-[#00e676]" size={20} />
            </div>
            <div className="bg-[#1c2230] rounded-2xl rounded-tl-sm p-4 text-sm text-gray-200 border border-[#2a3142]">
              <p>Hi! Welcome to TradingStudio. 👋</p>
              <p className="mt-2">I am your personal AI trading assistant. I'm here to help you automate your strategies, learn the markets, and grow your portfolio securely.</p>
            </div>
          </div>

          <div className="flex gap-4 mb-6 flex-row-reverse">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 border border-blue-500/30">
              <span className="text-blue-400 font-bold text-xs">YOU</span>
            </div>
            <div className="bg-blue-500/10 rounded-2xl rounded-tr-sm p-4 text-sm text-blue-100 border border-blue-500/20">
              <p>That sounds amazing! How do I get started?</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-[#00e676]/20 flex items-center justify-center flex-shrink-0 border border-[#00e676]/30">
              <Bot className="text-[#00e676]" size={20} />
            </div>
            <div className="bg-[#1c2230] rounded-2xl rounded-tl-sm p-4 text-sm text-gray-200 border border-[#2a3142] w-full">
              <p>It's simple! If you already have an IQ Option account, just sign in below. If not, create a free account using our community link to unlock Elite features!</p>
              
              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <Link 
                  href="/dashboard"
                  className="flex-1 flex items-center justify-center gap-2 bg-[#00e676] text-[#0b0e14] py-3 px-4 rounded-xl font-bold hover:bg-[#00c566] transition shadow-[0_0_15px_rgba(0,230,118,0.2)]"
                >
                  <PlayCircle size={18} /> Sign In to Dashboard
                </Link>
                <Link 
                  href="https://iqoption.net/lp/mobile-partner-pwa/?aff=788856&aff_model=revenue&afftrack="
                  target="_blank"
                  className="flex-1 flex items-center justify-center gap-2 bg-[#131823] border border-[#1e2330] text-white py-3 px-4 rounded-xl font-bold hover:bg-[#1c2230] hover:border-gray-500 transition"
                >
                  <UserPlus size={18} /> Create Free Account
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Copy / Details Section */}
        <div className="text-center max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Immerse Yourself in Trading.
          </h1>
          <p className="text-lg md:text-xl text-gray-400 mb-12 leading-relaxed">
            TradingStudio is a place where you can learn, trade, and automate your strategies effortlessly. Join a modern community of traders where beginners learn and grow alongside experts.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-[#131823] p-6 rounded-2xl border border-[#1e2330] hover:border-[#00e676]/50 transition">
              <BarChart3 className="text-[#00e676] mb-4" size={28} />
              <h3 className="text-xl font-bold mb-2">Automate Trades</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Set your limits and let our AI engine analyze charts 24/7, executing highly accurate signals while you sleep.</p>
            </div>
            <div className="bg-[#131823] p-6 rounded-2xl border border-[#1e2330] hover:border-blue-400/50 transition">
              <Users className="text-blue-400 mb-4" size={28} />
              <h3 className="text-xl font-bold mb-2">Grow Together</h3>
              <p className="text-gray-400 text-sm leading-relaxed">You're not alone. Become part of a thriving community where experts share strategies and beginners find their footing.</p>
            </div>
            <div className="bg-[#131823] p-6 rounded-2xl border border-[#1e2330] hover:border-purple-400/50 transition">
              <Shield className="text-purple-400 mb-4" size={28} />
              <h3 className="text-xl font-bold mb-2">Secure & Simple</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Connect directly to your IQ Option account with strict daily stop-loss protections. We prioritize your capital safety.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-[#1e2330] py-8 text-center text-gray-500 text-sm">
        <p>&copy; {new Date().getFullYear()} TradingStudio. All rights reserved.</p>
        <p className="mt-2">Disclaimer: Trading involves risk. Only trade with capital you can afford to lose.</p>
      </footer>
    </div>
  );
}