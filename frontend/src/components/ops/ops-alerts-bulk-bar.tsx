"use client";

interface OpsAlertsBulkBarProps {
  note: string;
  onBulkAction: (action: "acknowledge" | "resolve") => void | Promise<void>;
  onClearSelection: () => void;
  onNoteChange: (note: string) => void;
  selectedCount: number;
}

export function OpsAlertsBulkBar({
  note,
  onBulkAction,
  onClearSelection,
  onNoteChange,
  selectedCount,
}: OpsAlertsBulkBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-6 rounded-[2rem] border border-cyan-500/30 bg-black/80 px-8 py-5 backdrop-blur-2xl shadow-[0_40px_80px_-12px_rgba(6,182,212,0.5)] max-w-[95vw] overflow-hidden">
      <div className="flex items-center gap-4 border-r border-white/10 pr-6 mr-2 shrink-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 font-black italic">
          {selectedCount}
        </div>
        <div className="hidden sm:block">
          <p className="text-[10px] font-black uppercase tracking-widest text-white">批量中</p>
          <p className="text-[9px] font-bold text-white/30 uppercase tracking-tighter">个已选节点</p>
        </div>
      </div>
      <div className="flex items-center gap-4 min-w-0">
        <input
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="备注..."
          className="h-10 w-24 sm:w-48 rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-bold text-white outline-none focus:border-cyan-500/50 truncate"
        />
        <button
          onClick={() => void onBulkAction("acknowledge")}
          className="h-10 rounded-xl bg-cyan-500 px-4 sm:px-6 text-[10px] font-black uppercase text-black hover:bg-cyan-400 transition-all active:scale-95 shadow-[0_0_20px_rgba(6,182,212,0.4)] whitespace-nowrap"
        >
          确认
        </button>
        <button
          onClick={() => void onBulkAction("resolve")}
          className="h-10 rounded-xl border border-white/20 bg-white/10 px-4 sm:px-6 text-[10px] font-black uppercase text-white hover:bg-white/20 transition-all active:scale-95 whitespace-nowrap"
        >
          解决
        </button>
        <button
          onClick={onClearSelection}
          className="h-10 w-10 shrink-0 flex items-center justify-center text-white/20 hover:text-white transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  );
}
