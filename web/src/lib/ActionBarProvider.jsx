import React, { useMemo, useState } from "react";
import { ActionBarContext } from "./actionBarContext.js";

export default function ActionBarProvider({ children }) {
  const [homeAction, setHomeAction] = useState(null); // { label, onClick, disabled? }

  const value = useMemo(() => ({ homeAction, setHomeAction }), [homeAction]);
  return <ActionBarContext.Provider value={value}>{children}</ActionBarContext.Provider>;
}
