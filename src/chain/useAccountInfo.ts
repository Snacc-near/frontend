/**
 * Live reads for the connected account (UI-145). `refreshKey` re-runs every read, e.g. after a
 * transaction succeeds. Values stay `null` until the chain answers; the UI shows "—" for them.
 */
import { useEffect, useState } from "react";
import { fetchColony, fetchNearBalance, fetchSnaccBalance, fetchStorageState, fetchTotalWealth, type OwnedStrain, type StorageState } from "./accountViews.ts";

export interface AccountInfo {
  loading: boolean;
  /** Spendable NEAR, yocto. */
  nearYocto: string | null;
  /** `ft_balance_of`, yocto-$SNACC. */
  snaccYocto: string | null;
  /** `get_total_wealth`, yocto-$SNACC (wallet balance plus the strains' balances). */
  wealthYocto: string | null;
  storage: StorageState | null;
  colony: OwnedStrain[] | null;
}

export const EMPTY_ACCOUNT_INFO: AccountInfo = { loading: false, nearYocto: null, snaccYocto: null, wealthYocto: null, storage: null, colony: null };

export function useAccountInfo(accountId: string | null, refreshKey = 0): AccountInfo {
  const [info, setInfo] = useState<AccountInfo>(EMPTY_ACCOUNT_INFO);
  useEffect(() => {
    if (!accountId) {
      setInfo(EMPTY_ACCOUNT_INFO);
      return;
    }
    const ac = new AbortController();
    setInfo((prev) => ({ ...prev, loading: true }));
    void Promise.all([
      fetchNearBalance(accountId, ac.signal),
      fetchSnaccBalance(accountId, ac.signal),
      fetchTotalWealth(accountId, ac.signal),
      fetchStorageState(accountId, ac.signal),
      fetchColony(accountId, ac.signal),
    ]).then(([nearYocto, snaccYocto, wealthYocto, storage, colony]) => {
      if (ac.signal.aborted) return;
      setInfo({ loading: false, nearYocto, snaccYocto, wealthYocto, storage, colony });
    });
    return () => ac.abort();
  }, [accountId, refreshKey]);
  return info;
}
