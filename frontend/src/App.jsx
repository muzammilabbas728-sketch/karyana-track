import { useState } from "react";
import LoginPage from "./pages/LoginPage";
import SalesScreen from "./pages/SalesScreen";
import OwnerDashboard from "./pages/OwnerDashboard";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(
    Boolean(localStorage.getItem("auth_token"))
  );
  const [activeView, setActiveView] = useState("sales");

  function handleLoginSuccess() {
    setLoggedIn(Boolean(localStorage.getItem("auth_token")));
  }

  function handleLogout() {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_role");
    localStorage.removeItem("auth_name");
    setLoggedIn(false);
  }

  if (!loggedIn) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const name = localStorage.getItem("auth_name") || "Unknown";
  const role = localStorage.getItem("auth_role") || "Unknown";
  const isOwner = role === "owner";

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "1rem",
        background: "#f5f7fb",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1.5rem",
            padding: "1rem",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Karyana Track</h1>
            <p style={{ margin: "0.5rem 0 0" }}>
              Logged in as {name} ({role})
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#dc2626",
              color: "white",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Log Out
          </button>
        </header>

        <div style={{ marginBottom: "1rem" }}>
          <button
            type="button"
            onClick={() => setActiveView("sales")}
            style={{
              padding: "0.75rem 1rem",
              marginRight: isOwner ? "0.5rem" : 0,
              borderRadius: "8px",
              border: "none",
              backgroundColor: activeView === "sales" ? "#2563eb" : "#e2e8f0",
              color: activeView === "sales" ? "white" : "#1f2937",
              cursor: "pointer",
            }}
          >
            Sales
          </button>
          {isOwner ? (
            <button
              type="button"
              onClick={() => setActiveView("dashboard")}
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                border: "none",
                backgroundColor:
                  activeView === "dashboard" ? "#2563eb" : "#e2e8f0",
                color: activeView === "dashboard" ? "white" : "#1f2937",
                cursor: "pointer",
              }}
            >
              Dashboard
            </button>
          ) : null}
        </div>

        {activeView === "dashboard" && isOwner ? (
          <OwnerDashboard />
        ) : (
          <SalesScreen />
        )}
      </div>
    </main>
  );
}
