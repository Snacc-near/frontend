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
  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const zoneRef = useRef(zone);
  zoneRef.current = zone;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const [webglOk, setWebglOk] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglOk(hasWebGL());
  }, []);

  useEffect(() => {
    if (webglOk !== true) return;
    let disposed = false;
    let idleId: number | null = null;
    let engine: { setCells: (c: PlateCellInput[]) => void; setZone: (z: MacroZone) => void; setSelected: (id: number | null) => void; start: () => void; dispose: () => void } | null = null;
    const load = () => {
      if (disposed) return;
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
        // Apply the latest props immediately: the per-prop effects may have
        // already fired while the chunk was still loading and will not re-fire
        // until a value changes.
        engine.setCells(cellsRef.current);
        engine.setZone(zoneRef.current);
        engine.setSelected(selectedRef.current);
        engine.start();
      }).catch(() => {
        setWebglOk(false);
      });
    };
    // Defer the heavy three.js chunk until after first paint + load so the
    // initial page load stays fast; the canvas is blank until then.
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(load);
      } else {
        idleId = window.setTimeout(load, 150);
      }
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      disposed = true;
      if (idleId !== null) {
        if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleId);
        window.clearTimeout(idleId);
      }
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
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--bg)] px-4" role="region" aria-label="colony plate fallback">
        <div className="h-40 w-40 rounded-full border-2 border-[var(--ink-hi)] bg-[var(--pl-dish)] shadow-[8px_8px_0_var(--pl-shadow)]" aria-hidden="true" />
        <p className="text-xs lowercase text-[var(--ink)]">3d unavailable — tap a cell to open the lab</p>
        <div className="flex flex-wrap justify-center gap-2">
          {cells.map((cell) => (
            <button
              key={cell.id}
              type="button"
              onClick={() => callbacksRef.current(cell.id)}
              data-testid={`plate-cell-${cell.id}`}
              aria-label={`open strain ${cell.id}`}
              className="keycap min-h-[44px] px-4 text-xs focus-visible:ring-2 focus-visible:ring-[var(--accent-dk)] focus:outline-none"
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
