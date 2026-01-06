import React from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useActionBar } from "./lib/actionBarContext.js";

const tabStyle = ({ isActive }) => ({
  flex: 1,
  textAlign: "center",
  padding: 12,
  textDecoration: "none",
  fontWeight: isActive ? 800 : 600,
  opacity: isActive ? 1 : 0.7,
  color: "inherit"
});

export default function Layout() {

  const nav = useNavigate();
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const { homeAction } = useActionBar();

  const middleLabel = isHome && homeAction?.label ? homeAction.label : "Home";
  const middleDisabled = isHome && homeAction?.disabled;

  function onMiddleClick() {
    if (isHome && homeAction?.onClick) {
      homeAction.onClick();
    } else {
      nav("/");
    }
  }

  return (
    <div style={{ minHeight: "100dvh", paddingBottom: "calc(56px + env(safe-area-inset-bottom))" }}>
      <Outlet />

      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: 56,
          paddingBottom: "env(safe-area-inset-bottom)",
          borderTop: "1px solid #ddd",
          display: "flex",
          alignItems: "center",
          background: "white",
          color: "#646cff",
          zIndex: 9999
        }}
      >
        <NavLink to="/login" style={tabStyle}>Login</NavLink>

        <button
          onClick={onMiddleClick}
          disabled={!!middleDisabled}
          style={{
            flex: 1,
            textAlign: "center",
            padding: 12,
            border: "none",
            background: "transparent",
            fontWeight: 800,
            opacity: middleDisabled ? 0.4 : 1,
            cursor: middleDisabled ? "not-allowed" : "pointer"
          }}
        >
          {middleLabel}
        </button>

        <NavLink to="/settings" style={tabStyle}>Settings</NavLink>
      </div>
    </div>
  );
}