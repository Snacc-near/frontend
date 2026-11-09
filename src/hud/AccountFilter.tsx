/**
 * Input Filter Akun NEAR untuk Penyorotan Strain (UI-117..119 Live Mode).
 * Memungkinkan pemain memasukkan nama akun NEAR (tanpa login wallet) untuk
 * menyorot posisi sel NFT miliknya di dalam arena cawan petri.
 */

import React from "react";

interface AccountFilterProps {
  account: string;
  onChange: (account: string) => void;
  matchedCount: number;
}

export const AccountFilter: React.FC<AccountFilterProps> = ({
  account,
  onChange,
  matchedCount,
}) => {
  return (
    <div
      className="flex flex-col gap-1 px-3.5 py-1.5 rounded-2xl bg-slate-950/80 border border-slate-700/50 backdrop-blur-md shadow-lg"
      role="search"
      aria-label="penyorot akun near"
    >
      <div className="flex items-center gap-2">
        <label htmlFor="near-account-input" className="text-[11px] text-slate-400 lowercase whitespace-nowrap">
          sorot akun:
        </label>
        <input
          id="near-account-input"
          type="text"
          value={account}
          onChange={(e) => onChange(e.target.value)}
          placeholder="contoh: alice.testnet"
          className="bg-slate-900/90 border border-slate-800 text-slate-200 placeholder-slate-600 rounded-xl px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-cyan-500/70 min-h-[36px] w-44"
          spellCheck={false}
          autoComplete="off"
        />
        {account && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="hapus filter akun"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-900 text-slate-400 hover:text-slate-100 text-xs font-mono cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {account.trim().length > 0 && (
        <span className="text-[10px] lowercase font-mono">
          {matchedCount > 0 ? (
            <span className="text-cyan-400">
              menyorot {matchedCount} strain di cawan
            </span>
          ) : (
            <span className="text-slate-500">
              tidak ada strain milik akun ini di cawan
            </span>
          )}
        </span>
      )}
    </div>
  );
};
