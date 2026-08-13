import { useState } from "react";
import { colors, fonts, styles } from "./theme";
import LoginPage from "./pages/LoginPage";
import SalesScreen from "./pages/SalesScreen";
import OwnerDashboard from "./pages/OwnerDashboard";
import InventoryPage from "./pages/InventoryPage";
import UsersPage from "./pages/UsersPage";

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
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: fonts.body,
      }}
    >
      <aside
        style={{
          width: "220px",
          background: colors.surface,
          borderRight: `1px solid ${colors.border}`,
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div>
          <h1 style={{ ...styles.pageTitle, fontSize: "1.3rem" }}>Karyana Track</h1>
          <div style={{ ...styles.label, marginTop: "0.5rem" }}>
            {name} · {role}
          </div>
        </div>

        <div style={{ marginTop: "2rem", display: "flex", flexDirection: "column" }}>
          <button
            type="button"
            onClick={() => setActiveView("sales")}
            onMouseEnter={(event) => {
              if (activeView !== "sales") {
                event.currentTarget.style.backgroundColor = colors.bg;
              }
            }}
            onMouseLeave={(event) => {
              if (activeView !== "sales") {
                event.currentTarget.style.backgroundColor = "transparent";
              }
            }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              marginBottom: "0.5rem",
              backgroundColor: activeView === "sales" ? colors.primary : "transparent",
              color: activeView === "sales" ? "#fff" : colors.ink,
              fontFamily: fonts.body,
              fontWeight: 600,
            }}
          >
            Sales
          </button>

          {isOwner ? (
            <>
              <button
                type="button"
                onClick={() => setActiveView("dashboard")}
                onMouseEnter={(event) => {
                  if (activeView !== "dashboard") {
                    event.currentTarget.style.backgroundColor = colors.bg;
                  }
                }}
                onMouseLeave={(event) => {
                  if (activeView !== "dashboard") {
                    event.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  marginBottom: "0.5rem",
                  backgroundColor:
                    activeView === "dashboard" ? colors.primary : "transparent",
                  color: activeView === "dashboard" ? "#fff" : colors.ink,
                  fontFamily: fonts.body,
                  fontWeight: 600,
                }}
              >
                Dashboard
              </button>

              <button
                type="button"
                onClick={() => setActiveView("inventory")}
                onMouseEnter={(event) => {
                  if (activeView !== "inventory") {
                    event.currentTarget.style.backgroundColor = colors.bg;
                  }
                }}
                onMouseLeave={(event) => {
                  if (activeView !== "inventory") {
                    event.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  marginBottom: "0.5rem",
                  backgroundColor:
                    activeView === "inventory" ? colors.primary : "transparent",
                  color: activeView === "inventory" ? "#fff" : colors.ink,
                  fontFamily: fonts.body,
                  fontWeight: 600,
                }}
              >
                Inventory
              </button>

              <button
                type="button"
                onClick={() => setActiveView("users")}
                onMouseEnter={(event) => {
                  if (activeView !== "users") {
                    event.currentTarget.style.backgroundColor = colors.bg;
                  }
                }}
                onMouseLeave={(event) => {
                  if (activeView !== "users") {
                    event.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  marginBottom: "0.5rem",
                  backgroundColor:
                    activeView === "users" ? colors.primary : "transparent",
                  color: activeView === "users" ? "#fff" : colors.ink,
                  fontFamily: fonts.body,
                  fontWeight: 600,
                }}
              >
                Users
              </button>
            </>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          style={{
            ...styles.buttonDanger,
            width: "100%",
            marginTop: "auto",
          }}
        >
          Log Out
        </button>
      </aside>

      <main
        style={{
          flex: 1,
          padding: "2rem",
          overflowY: "auto",
          background: colors.bg,
        }}
      >
        {activeView === "dashboard" && isOwner ? (
          <OwnerDashboard />
        ) : activeView === "inventory" && isOwner ? (
          <InventoryPage />
        ) : activeView === "users" && isOwner ? (
          <UsersPage />
        ) : (
          <SalesScreen />
        )}
      </main>
    </div>
  );
}

