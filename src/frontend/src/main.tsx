import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReactDOM from "react-dom/client";
import App from "./App";
import { InternetIdentityProvider } from "./hooks/useInternetIdentity";
import "../index.css";
import { Backend } from "./backend";

// Polyfill: useActor.ts calls _initializeAccessControlWithSecret which maps to initializeAccessControl
if (!("_initializeAccessControlWithSecret" in Backend.prototype)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Backend.prototype as any)._initializeAccessControlWithSecret =
    async function (_adminToken: string) {
      return this.initializeAccessControl();
    };
}

BigInt.prototype.toJSON = function () {
  return this.toString();
};

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <InternetIdentityProvider>
      <App />
    </InternetIdentityProvider>
  </QueryClientProvider>,
);
