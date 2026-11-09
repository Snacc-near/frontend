/** Lazy 3D colony plate wrapper (three.js loads in a separate chunk). */
import React, { useEffect, useRef, useState } from "react";
import type { MacroZone } from "../config/zones.ts";
import type { PlateCellInput } from "../game/colony3d.ts";

interface ColonyPlateProps {
  cells: PlateCellInput[];
  zone: MacroZone;
  selectedId: number | null;
  onCellSelect: (cellId: number) => void;
  reducedMotion?: boolean;
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (gl) {
      const release = (gl.getExtension("WEBGL_lose_context") as { loseContext: () => void } | null);
      release?.loseContext();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export const ColonyPlate: React.FC<ColonyPlateProps> = ({
  cells,
  zone,
  selectedId,
  onCellSelect,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<{ setCells: (c: PlateCellInput[]) => void; setZone: (z: MacroZone) => void; setSelected: (id: number | null) => void; start: () => void; dispose: () => void } | null>(null);
  const callbacksRef = useRef(onCellSelect);
  callbacksRef.current = onCellSelect;
  const [webglOk, setWebglOk] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglOk(hasWebGL());
  }, []);

  useEffect(() => {
    if (webglOk !== true) return;
    let disposed = false;
    let engine: { setCells: (c: PlateCellInput[]) => void; setZone: (z: MacroZone) => void; setSelected: (id: number | null) => void; start: () => void; dispose: () => void } | null = null;
    import("../game/colony3d.ts").then(({ ColonyPlate3D }) => {
      if (disposed || !canvasRef.current) return;
      try {
        engine = new ColonyPlate3D(canvasRef.current, {
          onCellSelect: (id) => callbacksRef.current(id),
        });
      } catch {
        setWebglOk(false);
        return;
      }
      engineRef.current = engine;
      engine.start();
    }).catch(() => {
      setWebglOk(false);
    });
    return () => {
      disposed = true;
      engine?.dispose();
      engineRef.current = null;
    };
  }, [webglOk]);

  useEffect(() => {
    engineRef.current?.setCells(cells);
  }, [cells]);

  useEffect(() => {
    engineRef.current?.setZone(zone);
  }, [zone]);

  useEffect(() => {
    engineRef.current?.setSelected(selectedId);
  }, [selectedId]);

  if (webglOk === false) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-950 via-slate-950 to-violet-950 px-4" role="region" aria-label="colony plate fallback">
        <div className="h-40 w-40 rounded-full border-4 border-teal-300/40 bg-slate-900/80 shadow-[0_0_40px_rgba(45,212,191,0.25)]" aria-hidden="true" />
        <p className="text-xs lowercase text-slate-300">3d unavailable — tap a cell to open the lab</p>
        <div className="flex flex-wrap justify-center gap-2">
          {cells.map((cell) => (
            <button
              key={cell.id}
              type="button"
              onClick={() => callbacksRef.current(cell.id)}
              data-testid={`plate-cell-${cell.id}`}
              aria-label={`open strain ${cell.id}`}
              className="min-h-[44px] rounded-full bg-emerald-500 px-4 text-xs font-semibold lowercase text-slate-950 focus-visible:ring-2 focus-visible:ring-emerald-300 focus:outline-none"
            >
              strain #{cell.id}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full cursor-pointer touch-none"
        role="img"
        aria-label="isometric colony petri plate with living cells"
        data-testid="colony-plate"
      />
      <div className="sr-only" role="group" aria-label="colony cells">
        {cells.map((cell) => (
          <button
            key={cell.id}
            type="button"
            onClick={() => callbacksRef.current(cell.id)}
            data-testid={`plate-cell-${cell.id}`}
          >
            {`strain ${cell.id} ${cell.status}`}
          </button>
        ))}
      </div>
    </>
  );
};
