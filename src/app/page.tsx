import { AutoBotController } from "@/components/AutoBotController";

export default function Home() {
  return (
    <div className="min-h-screen bg-studio-bg flex flex-col items-center justify-center p-8 text-white">
      <div className="max-w-4xl w-full">
        <h1 className="text-4xl font-bold mb-8 text-center">TradingStudio</h1>
        <AutoBotController />
      </div>
    </div>
  );
}
