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
    <div className="flex flex-col gap-1 items-end">
      <div
        className="inline-flex items-center p-1 rounded-full bg-slate-950/80 border border-slate-700/50 backdrop-blur-md"
        role="group"
        aria-label="mode arena permainan"
      >
        <button
          type="button"
          onClick={() => onChange("demo")}
          aria-pressed={mode === "demo"}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold lowercase transition-all min-h-[36px] cursor-pointer ${
            mode === "demo"
              ? "bg-amber-400 text-slate-950 shadow-md font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          demo simulasi
        </button>

        <button
          type="button"
          onClick={() => onChange("live")}
          aria-pressed={mode === "live"}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold lowercase transition-all min-h-[36px] cursor-pointer flex items-center gap-1.5 ${
            mode === "live"
              ? "bg-emerald-500 text-slate-950 shadow-md font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isBackendConnected ? "bg-emerald-400" : "bg-amber-400"
            }`}
          />
          live testnet
        </button>
      </div>

      {mode === "demo" && (
        <span className="text-[10px] text-amber-400/90 font-mono lowercase pr-2">
          prototipe tampilan, data simulasi
        </span>
      )}
    </div>
  );
};
