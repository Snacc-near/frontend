// Game entry for the lazy `/app` route: keeps the game code out of the landing chunk.
import { App } from "./App.tsx";
import { WalletProvider } from "./chain/wallet.tsx";
import { SessionProvider } from "./account/session.tsx";
import { NotificationsProvider } from "./account/notifications.tsx";
import { applyStoredPrefs } from "./prefs/applyPrefs.ts";

// Saved reduce-motion and sound settings take effect before the first render.
applyStoredPrefs();

export default function GameEntry() {
  return (
    <WalletProvider>
      {/* UI-148/149: optional profile session and notifications; inert without the Supabase env. */}
      <SessionProvider>
        <NotificationsProvider>
          <App />
        </NotificationsProvider>
      </SessionProvider>
    </WalletProvider>
  );
}
