// Game entry for the lazy `/app` route: keeps the game code out of the landing chunk.
import { App } from "./App.tsx";
import { WalletProvider } from "./chain/wallet.tsx";

export default function GameEntry() {
  return (
    <WalletProvider>
      <App />
    </WalletProvider>
  );
}
