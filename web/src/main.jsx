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

/*
Landing Page
Login -> Username -> Password

Split Feed between Today and older Posts, or seen/new and old Posts
Only show new/unseen posts and show older/seen posts after clicking show more at end of feed.
Instead of having the Feed in a Scrollable Box

Muting Notifications for a certain Group does not work.

Group Setting displayed below the selected Group Button


*/