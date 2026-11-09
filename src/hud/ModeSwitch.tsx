import React from "react";
import type { GameMode } from "../game/engine.ts";

interface ModeSwitchProps {
  mode: GameMode;
  onChange: (mode: GameMode) => void;
  isBackendConnected: boolean;
}

export const ModeSwitch: React.FC<ModeSwitchProps> = ({
  mode,
  onChange,
  isBackendConnected,
}) => {
  return (
    <div className="flex flex-col gap-1 items-start">
      <div
        className="inline-flex items-center p-1 rounded-full bg-slate-950/80 border border-slate-700/50 backdrop-blur-md"
        role="group"
        aria-label="the game arena mode"
      >
        <button
          type="button"
          onClick={() => onChange("demo")}
          aria-pressed={mode === "demo"}
          className={`px-3.5 py-2 rounded-full text-xs font-semibold lowercase transition-all min-h-[44px] cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none ${
            mode === "demo"
              ? "bg-amber-400 text-slate-950 shadow-md font-bold"
              : "text-slate-300 hover:text-slate-100"
          }`}
        >
          demo simulasi
        </button>

        <button
          type="button"
          onClick={() => onChange("live")}
          aria-pressed={mode === "live"}
          className={`px-3.5 py-2 rounded-full text-xs font-semibold lowercase transition-all min-h-[44px] cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none ${
            mode === "live"
              ? "bg-emerald-500 text-slate-950 shadow-md font-bold"
              : "text-slate-300 hover:text-slate-100"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isBackendConnected ? "bg-emerald-400" : "bg-amber-400"
            }`}
          />
          live testnet
        </button>
      </div>

      {mode === "demo" && (
        <span className="text-[10px] text-amber-300 font-mono lowercase pl-2">
          prototipe tampilan, data simulasi
        </span>
      )}
    </div>
  );
};
