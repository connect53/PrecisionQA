import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shield, Cpu, Activity, Database, Sparkles } from "lucide-react";

interface PrecisionLoaderProps {
  onComplete: () => void;
}

const LOADING_STEPS = [
  { minProgress: 0, text: "Initializing Precision360 engine...", icon: Cpu },
  { minProgress: 20, text: "Calibrating database and memory parameters...", icon: Database },
  { minProgress: 45, text: "Verifying secure user session and credentials...", icon: Shield },
  { minProgress: 70, text: "Synchronizing system QA metrics & workspace stream...", icon: Activity },
  { minProgress: 90, text: "Defragmenting memory pools. Precision active...", icon: Sparkles },
];

export default function PrecisionLoader({ onComplete }: PrecisionLoaderProps) {
  const [progress, setProgress] = useState(0);
  const [activeStepText, setActiveStepText] = useState(LOADING_STEPS[0].text);
  const [ActiveIcon, setActiveIcon] = useState<any>(LOADING_STEPS[0].icon);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const startTime = Date.now();
    const duration = 350; // Accelerated 350ms loading sequence

    const updateLoader = () => {
      const elapsed = Date.now() - startTime;
      const computedProgress = Math.min(100, Math.floor((elapsed / duration) * 100));
      
      setProgress(computedProgress);

      // Find active loading text step
      const currentStep = [...LOADING_STEPS]
        .reverse()
        .find(step => computedProgress >= step.minProgress);
      
      if (currentStep) {
        setActiveStepText(currentStep.text);
        setActiveIcon(currentStep.icon);
      }

      if (computedProgress < 100) {
        timer = setTimeout(updateLoader, 15);
      } else {
        // Hold for 50ms at 100% for smooth entry transition
        timer = setTimeout(() => {
          onComplete();
        }, 50);
      }
    };

    timer = setTimeout(updateLoader, 15);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 min-h-screen bg-[#070a13] text-slate-100 flex flex-col items-center justify-center overflow-hidden font-sans select-none z-50">
      {/* Background Decorative Matrix Grid */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px"
        }}
      />
      
      {/* Background Radial Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] bg-teal-500/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative flex flex-col items-center max-w-md w-full px-8 text-center">
        {/* Animated Precision Logo */}
        <div className="relative w-40 h-40 flex items-center justify-center mb-8">
          {/* Outer Calibration Ring */}
          <motion.svg
            className="absolute inset-0 w-full h-full text-blue-500/30"
            viewBox="0 0 100 100"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.75"
              strokeDasharray="4 8"
            />
          </motion.svg>

          {/* Middle High-Speed Dash Ring */}
          <motion.svg
            className="absolute inset-0 w-full h-full text-teal-400/40"
            viewBox="0 0 100 100"
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
          >
            <circle
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="1 3"
            />
          </motion.svg>

          {/* Inner Segmented Solid Ring */}
          <motion.svg
            className="absolute inset-0 w-full h-full text-blue-400"
            viewBox="0 0 100 100"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
          >
            <circle
              cx="50"
              cy="50"
              r="30"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="100"
              strokeDashoffset="45"
            />
          </motion.svg>

          {/* Precision Target Crosshairs */}
          <svg className="absolute inset-0 w-full h-full text-slate-500/40" viewBox="0 0 100 100">
            {/* Center target cross lines */}
            <line x1="50" y1="12" x2="50" y2="24" stroke="currentColor" strokeWidth="0.75" />
            <line x1="50" y1="76" x2="50" y2="88" stroke="currentColor" strokeWidth="0.75" />
            <line x1="12" y1="50" x2="24" y2="50" stroke="currentColor" strokeWidth="0.75" />
            <line x1="76" y1="50" x2="88" y2="50" stroke="currentColor" strokeWidth="0.75" />
            
            {/* Extremely fine center dot guide */}
            <circle cx="50" cy="50" r="1.5" fill="#38bdf8" />
          </svg>

          {/* Core Glowing Orb */}
          <motion.div
            className="relative w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-teal-400 flex items-center justify-center shadow-[0_0_25px_rgba(56,189,248,0.5)] border border-white/20"
            animate={{
              scale: [1, 1.12, 1],
            }}
            transition={{
              repeat: Infinity,
              duration: 2,
              ease: "easeInOut",
            }}
          >
            {/* Inner tiny radar indicator */}
            <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
          </motion.div>
        </div>

        {/* Brand Header */}
        <div className="space-y-1 mb-8">
          <h2 className="text-xl font-medium tracking-[0.25em] text-white uppercase font-sans">
            Precision<span className="text-teal-400 font-bold">QA</span>
          </h2>
          <p className="text-[10px] tracking-[0.4em] text-slate-400 uppercase font-sans font-medium">
            Quality Management Suite
          </p>
        </div>

        {/* Progress Bar Container */}
        <div className="w-full bg-slate-800/50 backdrop-blur-sm border border-slate-700/30 rounded-full h-1.5 overflow-hidden mb-5 p-[1px] relative">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-400 rounded-full relative"
            style={{ width: `${progress}%` }}
            layoutId="progressBar"
          >
            {/* Glowing tip */}
            <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_8px_rgba(56,189,248,1)]" />
          </motion.div>
        </div>

        {/* Loading Diagnostics Stream */}
        <div className="min-h-12 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStepText}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-2 text-xs font-medium text-slate-300 dark:text-slate-300"
            >
              {ActiveIcon && <ActiveIcon className="w-3.5 h-3.5 text-teal-400 animate-pulse" />}
              <span className="font-mono text-[11px] tracking-wide">{activeStepText}</span>
            </motion.div>
          </AnimatePresence>

          <div className="mt-2 text-[10px] font-mono text-slate-500 tracking-wider font-bold">
            PROGRESS: {progress}%
          </div>
        </div>
      </div>

      {/* Decorative Corner Guides to emphasize Precision Instrument style */}
      <div className="absolute top-6 left-6 w-4 h-4 border-t-2 border-l-2 border-slate-800" />
      <div className="absolute top-6 right-6 w-4 h-4 border-t-2 border-r-2 border-slate-800" />
      <div className="absolute bottom-6 left-6 w-4 h-4 border-b-2 border-l-2 border-slate-800" />
      <div className="absolute bottom-6 right-6 w-4 h-4 border-b-2 border-r-2 border-slate-800" />

      {/* Security Signature Footnote */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[9px] font-mono text-slate-600 tracking-widest uppercase">
        SECURE INTEGRITY SYSTEM V2.4.0
      </div>
    </div>
  );
}
