import { createContext, useContext } from "react";

export const ActionBarContext = createContext(null);

export function useActionBar() {
  const ctx = useContext(ActionBarContext);
  if (!ctx) throw new Error("useActionBar must be used inside ActionBarProvider");
  return ctx;
}
