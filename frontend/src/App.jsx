import { useState, useEffect } from "react";
import { colors, fonts, styles } from "./theme";
import { getLicenseStatus } from "./api/client";
import ActivationPage from "./pages/ActivationPage";
import LoginPage from "./pages/LoginPage";
import SalesScreen from "./pages/SalesScreen";
import OwnerDashboard from "./pages/OwnerDashboard";
import InventoryPage from "./pages/InventoryPage";
import UsersPage from "./pages/UsersPage";
import CustomersPage from "./pages/CustomersPage";
import SalesHistoryPage from "./pages/SalesHistoryPage";
import SuppliersPage from "./pages/SuppliersPage";
import CashManagementPage from "./pages/CashManagementPage";

export default function App() {
  const [licenseChecked, setLicenseChecked] = useState(false);
  const [isLicensed, setIsLicensed] = useState(false);
  const [loggedIn, setLoggedIn] = useState(
    Boolean(localStorage.getItem("auth_token"))
  );
  const [activeView, setActiveView] = useState("sales");
  const [theme, setTheme] = useState(
    () => localStorage.getItem("app_theme") || "light"
  );

  useEffect(() => {
    getLicenseStatus()
      .then((data) => {
        setIsLicensed(Boolean(data?.licensed));
      })
      .catch(() => {
        setIsLicensed(false);
      })
      .finally(() => {
        setLicenseChecked(true);
      });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("app_theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  function handleLoginSuccess() {
    setLoggedIn(Boolean(localStorage.getItem("auth_token")));
  }

  function handleLogout() {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_role");
    localStorage.removeItem("auth_name");
    setLoggedIn(false);
  }

  if (!licenseChecked) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: colors.bg,
          fontFamily: fonts.body,
          color: colors.ink,
        }}
      >
        <p>Loading...</p>
      </div>
    );
  }

  if (!isLicensed) {
    return <ActivationPage onActivated={() => window.location.reload()} />;
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
        height: "100vh",
        overflow: "hidden",
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
          overflowY: "auto",
          height: "100%",
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

          <button
            type="button"
            onClick={() => setActiveView("sales-history")}
            onMouseEnter={(event) => {
              if (activeView !== "sales-history") {
                event.currentTarget.style.backgroundColor = colors.bg;
              }
            }}
            onMouseLeave={(event) => {
              if (activeView !== "sales-history") {
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
                activeView === "sales-history" ? colors.primary : "transparent",
              color: activeView === "sales-history" ? "#fff" : colors.ink,
              fontFamily: fonts.body,
              fontWeight: 600,
            }}
          >
            Sales History
          </button>

          <button
            type="button"
            onClick={() => setActiveView("customers")}
            onMouseEnter={(event) => {
              if (activeView !== "customers") {
                event.currentTarget.style.backgroundColor = colors.bg;
              }
            }}
            onMouseLeave={(event) => {
              if (activeView !== "customers") {
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
                activeView === "customers" ? colors.primary : "transparent",
              color: activeView === "customers" ? "#fff" : colors.ink,
              fontFamily: fonts.body,
              fontWeight: 600,
            }}
          >
            Customers
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
                onClick={() => setActiveView("cash")}
                onMouseEnter={(event) => {
                  if (activeView !== "cash") {
                    event.currentTarget.style.backgroundColor = colors.bg;
                  }
                }}
                onMouseLeave={(event) => {
                  if (activeView !== "cash") {
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
                    activeView === "cash" ? colors.primary : "transparent",
                  color: activeView === "cash" ? "#fff" : colors.ink,
                  fontFamily: fonts.body,
                  fontWeight: 600,
                }}
              >
                Cash Management
              </button>

              <button
                type="button"
                onClick={() => setActiveView("suppliers")}
                onMouseEnter={(event) => {
                  if (activeView !== "suppliers") {
                    event.currentTarget.style.backgroundColor = colors.bg;
                  }
                }}
                onMouseLeave={(event) => {
                  if (activeView !== "suppliers") {
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
                    activeView === "suppliers" ? colors.primary : "transparent",
                  color: activeView === "suppliers" ? "#fff" : colors.ink,
                  fontFamily: fonts.body,
                  fontWeight: 600,
                }}
              >
                Suppliers
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
          onClick={toggleTheme}
          style={{
            ...styles.buttonSecondary,
            width: "100%",
            marginTop: "auto",
            marginBottom: "0.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
          }}
        >
          {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          style={{
            ...styles.buttonDanger,
            width: "100%",
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
          height: "100%",
          background: colors.bg,
        }}
      >
        {activeView === "sales-history" ? (
          <SalesHistoryPage />
        ) : activeView === "dashboard" && isOwner ? (
          <OwnerDashboard
            onNavigateToCash={() => setActiveView("cash")}
            onNavigateToInventory={() => setActiveView("inventory")}
          />
        ) : activeView === "cash" && isOwner ? (
          <CashManagementPage />
        ) : activeView === "suppliers" && isOwner ? (
          <SuppliersPage />
        ) : activeView === "inventory" && isOwner ? (
          <InventoryPage />
        ) : activeView === "users" && isOwner ? (
          <UsersPage />
        ) : activeView === "customers" ? (
          <CustomersPage />
        ) : (
          <SalesScreen />
        )}
      </main>
    </div>
  );
}
