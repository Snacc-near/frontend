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
      className="flex flex-col gap-1 px-2.5 sm:px-3.5 py-1.5 rounded-2xl bg-slate-950/80 border border-slate-700/50 backdrop-blur-md shadow-lg"
      role="search"
      aria-label="near account highlighter"
    >
      <div className="flex items-center gap-2">
        <label htmlFor="near-account-input" className="text-[11px] text-slate-300 lowercase whitespace-nowrap">
          highlight account:
        </label>
        <input
          id="near-account-input"
          type="text"
          value={account}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g.: alice.testnet"
          className="bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-mono focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none min-h-[40px] sm:min-h-[44px] w-36 sm:w-48 min-w-0 transition-all"
          spellCheck={false}
          autoComplete="off"
        />
        {account && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="clear the account filter"
            className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 flex items-center justify-center rounded-xl bg-slate-900 text-slate-300 hover:text-slate-100 hover:bg-slate-800 text-xs font-mono cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none"
          >
            ✕
          </button>
        )}
      </div>

      {account.trim().length > 0 && (
        <span className="text-[10px] lowercase font-mono">
          {matchedCount > 0 ? (
            <span className="text-cyan-300 font-semibold">
              highlighting {matchedCount} strains in the dish
            </span>
          ) : (
            <span className="text-slate-400">
              no strain owned by this account in the dish
            </span>
          )}
        </span>
      )}
    </div>
  );
};
