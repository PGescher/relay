import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ActionBarProvider from "./lib/ActionBarProvider.jsx";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ActionBarProvider>
      <App />
    </ActionBarProvider>
  </React.StrictMode>
);
