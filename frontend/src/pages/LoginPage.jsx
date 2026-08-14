import { useState, useEffect } from "react";
import { login } from "../api/client";
import { colors, fonts, styles } from "../theme";

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("app_theme") || "light"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("app_theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await login(username, pin);
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_role", data.role);
      localStorage.setItem("auth_name", data.name);
      onLoginSuccess();
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        background: colors.bg,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "400px",
          ...styles.card,
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <h2 style={{ ...styles.pageTitle, fontSize: "1.6rem", margin: 0 }}>
            Log In
          </h2>
          <button
            type="button"
            onClick={toggleTheme}
            style={{
              ...styles.buttonSecondary,
              padding: "0.4rem 0.75rem",
              fontSize: "0.85rem",
            }}
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>

        <label style={{ display: "block", marginBottom: "0.75rem", ...styles.label }}>
          Username
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            style={{
              ...styles.input,
              marginTop: "0.5rem",
            }}
          />
        </label>

        <label style={{ display: "block", marginBottom: "1rem", ...styles.label }}>
          PIN
          <input
            type="password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            style={{
              ...styles.input,
              marginTop: "0.5rem",
            }}
          />
        </label>

        {error ? (
          <p style={{ color: colors.danger, marginBottom: "1rem" }}>{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          style={{
            ...styles.buttonPrimary,
            width: "100%",
            backgroundColor: loading ? colors.muted : colors.primary,
          }}
        >
          {loading ? "Logging in..." : "Log In"}
        </button>
      </form>
    </div>
  );
}
