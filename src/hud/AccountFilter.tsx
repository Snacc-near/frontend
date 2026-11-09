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
        <label htmlFor="near-account-input" className="text-[11px] text-slate-300 lowercase whitespace-nowrap">
          sorot akun:
        </label>
        <input
          id="near-account-input"
          type="text"
          value={account}
          onChange={(e) => onChange(e.target.value)}
          placeholder="contoh: alice.testnet"
          className="bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2 text-xs font-mono focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none min-h-[44px] w-48 transition-all"
          spellCheck={false}
          autoComplete="off"
        />
        {account && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="hapus filter akun"
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-900 text-slate-300 hover:text-slate-100 hover:bg-slate-800 text-xs font-mono cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none"
          >
            ✕
          </button>
        )}
      </div>

      {account.trim().length > 0 && (
        <span className="text-[10px] lowercase font-mono">
          {matchedCount > 0 ? (
            <span className="text-cyan-300 font-semibold">
              menyorot {matchedCount} strain di cawan
            </span>
          ) : (
            <span className="text-slate-400">
              tidak ada strain milik akun ini di cawan
            </span>
          )}
        </span>
      )}
    </div>
  );
};
