import { AnimatePresence, motion } from "framer-motion";

interface ExportModalProps {
  isOpen: boolean;
  resultDisabled: boolean;
  onClose: () => void;
  onExportJson: () => void;
  onExportOverlay: () => void;
}

export function ExportModal({
  isOpen,
  resultDisabled,
  onClose,
  onExportJson,
  onExportOverlay,
}: ExportModalProps) {
  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-[#0B1120]/90 p-8 shadow-[0_32px_128px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
          >
            <div className="absolute -right-24 -top-24 h-48 w-48 rounded-full bg-sky-500/10 blur-[64px]" />
            <div className="absolute -left-24 -bottom-24 h-48 w-48 rounded-full bg-indigo-500/10 blur-[64px]" />

            <div className="relative">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-light tracking-tight text-white/90">
                    数据导出与下载
                  </h3>
                  <p className="mt-1 text-xs text-white/40">
                    选择所需的文件格式进行推理结果导出
                  </p>
                </div>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/30 transition-colors hover:bg-white/10 hover:text-white"
                  onClick={onClose}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <button
                  className="group relative flex w-full items-center gap-5 rounded-2xl border border-white/5 bg-white/[0.03] p-5 text-left transition-all hover:border-sky-500/30 hover:bg-sky-500/5"
                  onClick={() => {
                    onExportJson();
                    onClose();
                  }}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-400 transition-transform group-hover:scale-110">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white/80 group-hover:text-white">JSON 数据</h4>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/40">
                      包含完整的检测元数据及像素级坐标，适用于开发者二次开发。
                    </p>
                  </div>
                </button>

                <button
                  className="group relative flex w-full items-center gap-5 rounded-2xl border border-white/5 bg-white/[0.03] p-5 text-left transition-all hover:border-emerald-500/30 hover:bg-emerald-500/5 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={resultDisabled}
                  onClick={() => {
                    onExportOverlay();
                    onClose();
                  }}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 transition-transform group-hover:scale-110">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white/80 group-hover:text-white">合成结果图</h4>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/40">
                      包含可视化检测框与掩膜的合成图像，适用于报告文档演示。
                    </p>
                  </div>
                  {!resultDisabled ? (
                    <div className="ml-auto opacity-0 transition-opacity group-hover:opacity-100">
                      <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  ) : null}
                </button>
              </div>

              <div className="mt-8 border-t border-white/5 pt-6">
                <button
                  className="w-full rounded-xl bg-white/5 py-2.5 text-xs font-medium text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                  onClick={onClose}
                >
                  取消
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
