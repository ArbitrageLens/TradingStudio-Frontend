import { AutoBotController } from "@/components/AutoBotController";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-[#0b0e14] flex flex-col items-center justify-center p-8 text-white">
      <div className="w-full">
        <AutoBotController />
      </div>
    </div>
  );
}