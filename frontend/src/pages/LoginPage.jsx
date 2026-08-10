import { useState } from "react";
import { login } from "../api/client";

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

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
        background: "#f5f7fb",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "2rem",
          border: "1px solid #ddd",
          borderRadius: "12px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
          background: "#fff",
        }}
      >
        <h2 style={{ marginBottom: "1rem" }}>Log In</h2>

        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          Username
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            style={{
              width: "100%",
              padding: "0.75rem",
              marginTop: "0.5rem",
              borderRadius: "8px",
              border: "1px solid #ccc",
            }}
          />
        </label>

        <label style={{ display: "block", marginBottom: "1rem" }}>
          PIN
          <input
            type="password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            style={{
              width: "100%",
              padding: "0.75rem",
              marginTop: "0.5rem",
              borderRadius: "8px",
              border: "1px solid #ccc",
            }}
          />
        </label>

        {error ? (
          <p style={{ color: "#d00", marginBottom: "1rem" }}>{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.85rem",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "#2563eb",
            color: "white",
            fontWeight: "600",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Logging in..." : "Log In"}
        </button>
      </form>
    </div>
  );
}
