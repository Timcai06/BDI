"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import type { BridgeV1 } from "@/lib/types";

export interface BatchWizardPayload {
  sourceType: string;
  expectedItemCount: number;
  inspectionLabel?: string;
  enhancementMode: "off" | "auto" | "always";
}

interface IngestionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  bridges: BridgeV1[];
  onFinish: (bridgeId: string, batchPayload: BatchWizardPayload, files: File[]) => Promise<void>;
  selectedBridgeId: string;
  onSelectedBridgeChange: (id: string) => void;
  isLoading: boolean;
}

export function IngestionWizard({
  isOpen,
  onClose,
  bridges,
  onFinish,
  selectedBridgeId,
  onSelectedBridgeChange,
  isLoading
}: IngestionWizardProps) {
  const [step, setStep] = useState(1);
  const [sourceType, setSourceType] = useState("drone-survey");
  const [inspectionLabel, setInspectionLabel] = useState("");
  const [enhancementMode, setEnhancementMode] = useState<"off" | "auto" | "always">("auto");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadMode, setUploadMode] = useState<"files" | "folder">("files");
  const folderInputProps: Record<string, string> =
    uploadMode === "folder" ? { webkitdirectory: "", directory: "" } : {};

  // Step 1: Bridge Selection/Creation
  // Step 2: Batch Definition
  // Step 3: File Upload & Finalize

  const handleNext = async () => {
    if (step === 1 && selectedBridgeId) {
      setStep(2);
    } else if (step === 2) {
      // Logic for creating batch will happen in parent, we just transition UI
      setStep(3);
    }
  };

  const handleFinish = async () => {
    const payload: BatchWizardPayload = {
      sourceType,
      expectedItemCount: 0,
      inspectionLabel: inspectionLabel.trim() || undefined,
      enhancementMode
    };
    await onFinish(selectedBridgeId, payload, uploadFiles);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md" 
      />
      
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-2xl overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0B1120] p-8 shadow-2xl lg:p-12"
      >
        {/* Progress Bar */}
        <div className="mb-12 flex gap-2">
          {[1, 2, 3].map((s) => (
            <div 
              key={s} 
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                s <= step ? "bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" : "bg-white/5"
              }`} 
            />
          ))}
        </div>

        <section className="min-h-[320px]">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-light text-white">选择桥梁资产</h2>
                  <p className="text-sm text-white/40 mt-1">批次属于桥梁资产。若没有桥梁，请先返回桥梁资产页创建。</p>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 px-1">已有桥梁</label>
                    <select
                      value={selectedBridgeId}
                      onChange={(e) => onSelectedBridgeChange(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/50"
                    >
                      <option value="">快速选择...</option>
                      {bridges.map((b) => (
                        <option key={b.id} value={b.id}>{b.bridge_code} | {b.bridge_name}</option>
                      ))}
                    </select>
                  </div>
                  <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/45">
                    桥梁资产创建已提升为第一层入口。这里仅为当前桥梁创建批次。
                  </p>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-light text-white">批次扫描属性</h2>
                  <p className="text-sm text-white/40 mt-1">定义巡检来源与增强策略，批次编号由系统自动生成</p>
                </div>

                <div className="grid gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 px-1">巡检标识 (Optional)</label>
                    <input
                      value={inspectionLabel}
                      onChange={(e) => setInspectionLabel(e.target.value)}
                      placeholder="例如：主桥上行 4 月无人机巡检"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/50"
                    />
                    <p className="px-1 text-[11px] text-white/35">系统将自动生成批次编码，避免重复和手工错误。</p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 px-1">数据源类型 (Source Type)</label>
                    <select
                      value={sourceType}
                      onChange={(e) => setSourceType(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/50 appearance-none transition-all hover:bg-white/[0.05]"
                    >
                      <option value="drone-survey">无人机影像 (Drone)</option>
                      <option value="crawler-inspection">机器人巡检 (Crawler)</option>
                      <option value="manual-capture">手动离线上传 (Manual)</option>
                      <option value="fixed-camera">固定监测点 (Fixed)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 px-1">增强策略 (Enhancement Strategy)</label>
                    <select
                      value={enhancementMode}
                      onChange={(e) => setEnhancementMode(e.target.value as "off" | "auto" | "always")}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/50 appearance-none transition-all hover:bg-white/[0.05]"
                    >
                      <option value="auto">自动增强低照度图片</option>
                      <option value="always">本批次全部增强后复检</option>
                      <option value="off">仅保留原图识别</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-light text-white">素材导入</h2>
                  <p className="text-sm text-white/40 mt-1">支持批量选择或文件夹扫描，入库后将自动进入云端推理引擎</p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setUploadMode("files")}
                      className={`rounded-xl border p-3 text-xs font-bold uppercase tracking-widest transition-all ${
                        uploadMode === "files" ? "bg-white/10 border-cyan-500/50 text-cyan-400" : "bg-white/5 border-white/5 text-white/30"
                      }`}
                    >
                      单选文件模式
                    </button>
                    <button
                      onClick={() => setUploadMode("folder")}
                      className={`rounded-xl border p-3 text-xs font-bold uppercase tracking-widest transition-all ${
                        uploadMode === "folder" ? "bg-white/10 border-cyan-500/50 text-cyan-400" : "bg-white/5 border-white/5 text-white/30"
                      }`}
                    >
                      文件夹扫描模式
                    </button>
                  </div>

                  <label className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] transition-colors hover:bg-white/[0.04] hover:border-cyan-500/30">
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      {...folderInputProps}
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        setUploadFiles((prev) => [...prev, ...files]);
                      }}
                    />
                    <svg className="h-8 w-8 text-white/20 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span className="text-xs text-white/40">点击或并入文件到此处</span>
                  </label>

                  {uploadFiles.length > 0 && (
                    <div className="flex items-center justify-between px-2">
                      <span className="text-xs text-cyan-400 font-bold">已就绪：{uploadFiles.length} 张原始影像</span>
                      <button onClick={() => setUploadFiles([])} className="text-[10px] text-white/20 uppercase hover:text-rose-400">清空</button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <footer className="mt-12 flex justify-between gap-4">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="rounded-xl border border-white/10 px-8 py-3.5 text-sm font-bold tracking-widest uppercase text-white/50 transition-all hover:bg-white/5 hover:text-white"
          >
            {step === 1 ? "取消" : "返回上一层"}
          </button>
          
          <button
            onClick={step === 3 ? handleFinish : handleNext}
            disabled={isLoading}
            className="rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 px-8 py-3.5 text-sm font-bold tracking-widest uppercase text-black transition-all hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] disabled:opacity-50"
          >
            {isLoading ? "执行中..." : step === 3 ? "立即启动云端扫描" : "下一步流程"}
          </button>
        </footer>
      </motion.div>
    </div>
  );
}
