import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./Layout.jsx";

import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import Settings from "./pages/Settings.jsx";
import Join from "./pages/Join.jsx";
import Groups from "./pages/Groups.jsx";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/join/:code" element={<Join />} />
          <Route path="/groups" element={<Groups />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}