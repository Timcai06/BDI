'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Specs {
  [key: string]: string | undefined;
}

interface Disease {
  name: string;
  color: string;
  image: string;
  specs: Specs;
  details: string;
}

interface PathologyDetailProps {
  disease: Disease | null;
  onClose: () => void;
}

export const PathologyDetail: React.FC<PathologyDetailProps> = ({ disease, onClose }) => {
  if (!disease) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 bg-[#050507]/90 backdrop-blur-xl"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-6xl max-h-[90vh] bg-[#0a0a0c] border border-[#3d3a39] overflow-hidden flex flex-col md:flex-row shadow-[0_0_100px_rgba(0,0,0,0.5)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 z-50 text-[#8b949e] hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Left Column: HD Image & Scan */}
          <div className="w-full md:w-[55%] relative h-[300px] md:h-auto border-b md:border-b-0 md:border-r border-[#3d3a39] overflow-hidden group">
            <img 
              src={disease.image} 
              alt={disease.name}
              className="w-full h-full object-cover opacity-90"
            />
            {/* Scanning Line Animation */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#00d992]/20 to-transparent h-20 w-full animate-[scan_4s_linear_infinite]" />
            
            {/* Corner Brackets */}
            <div className="absolute inset-8 pointer-events-none">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#00d992]" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#00d992]" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#00d992]" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#00d992]" />
            </div>

            <div className="absolute top-8 left-8 font-mono text-[10px] text-[#00d992] bg-black/60 px-3 py-1 border border-[#00d992]/30">
               ANALYSIS_LAYER: [HI_RES_RAW]
            </div>
          </div>

          {/* Right Column: Specs & Charts */}
          <div className="w-full md:w-[45%] p-8 md:p-12 flex flex-col overflow-y-auto">
             <div className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                   <div className="h-2 w-2 rounded-full bg-[#00d992] animate-pulse" />
                   <span className="font-mono text-[10px] text-[#00d992] tracking-widest uppercase">Target_Identified</span>
                </div>
                <h2 className="text-4xl font-black text-[#f2f2f2] tracking-tighter uppercase mb-4">
                  {disease.name}
                </h2>
                <p className="text-[#8b949e] font-mono text-xs leading-relaxed uppercase tracking-wide opacity-80">
                  {disease.details}
                </p>
             </div>

             {/* Specs Grid */}
             <div className="grid grid-cols-2 gap-4 mb-12">
                {Object.entries(disease.specs).map(([key, value]) => (
                  value && (
                    <div key={key} className="p-4 border border-[#3d3a39] bg-[#101010]/50">
                      <div className="font-mono text-[9px] text-[#8b949e] uppercase mb-1">{key}</div>
                      <div className="font-mono text-sm text-[#f2f2f2] font-bold">{value}</div>
                    </div>
                  )
                ))}
             </div>

             {/* Mini Analysis Chart (SVG) */}
             <div className="mb-12">
                <div className="font-mono text-[10px] text-[#8b949e] uppercase mb-4 tracking-[0.2em]">Risk_Profile_Analysis</div>
                <div className="h-32 w-full border border-[#3d3a39] relative overflow-hidden bg-[#050507]">
                   <svg className="w-full h-full overflow-visible" viewBox="0 0 400 100">
                      <path 
                        d="M0,80 Q50,20 100,50 T200,30 T300,70 T400,10" 
                        fill="none" 
                        stroke="#00d992" 
                        strokeWidth="1.5"
                        strokeDasharray="400"
                        strokeDashoffset="400"
                        className="animate-[draw_2s_ease-out_forwards]"
                      />
                      <rect x="0" y="0" width="400" height="100" fill="url(#grid)" />
                      <defs>
                        <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
                          <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#222" strokeWidth="0.5"/>
                        </pattern>
                      </defs>
                   </svg>
                </div>
             </div>

             <div className="mt-auto pt-8 border-t border-[#3d3a39]">
                <button className="w-full py-4 border border-[#00d992] text-[#00d992] font-mono text-[11px] font-bold tracking-[0.3em] uppercase transition-all hover:bg-[#00d992] hover:text-black">
                  Run_Extensive_Diagnostic_Sync
                </button>
             </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
