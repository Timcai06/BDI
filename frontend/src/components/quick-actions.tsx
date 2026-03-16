"use client";

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  accentColor: string;
  disabled?: boolean;
}

interface QuickActionsProps {
  actions: QuickAction[];
}

export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <div className="rounded-[20px] border border-white/[0.04] bg-[#030303] p-5 shadow-[0_0_40px_rgba(0,0,0,0.3)] backdrop-blur-xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-4">
        快捷操作
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`group relative flex flex-col items-center gap-3 p-4 rounded-xl border transition-all duration-300 ${
              action.disabled
                ? "border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed"
                : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] hover:scale-[1.02]"
            }`}
          >
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
              style={{ 
                backgroundColor: `${action.accentColor}15`,
                color: action.accentColor
              }}
            >
              {action.icon}
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-white/90">{action.label}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{action.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
