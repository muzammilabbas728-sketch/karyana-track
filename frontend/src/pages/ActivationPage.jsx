import { useState, useEffect } from "react";
import { getLicenseStatus, activateLicense } from "../api/client";
import { colors, fonts, styles } from "../theme";

export default function ActivationPage({ onActivated }) {
  const [fingerprint, setFingerprint] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingStatus, setFetchingStatus] = useState(true);
  const [copied, setCopied] = useState(false);
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

  useEffect(() => {
    let isMounted = true;
    setFetchingStatus(true);
    getLicenseStatus()
      .then((data) => {
        if (isMounted && data?.fingerprint) {
          setFingerprint(data.fingerprint);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load device information");
        }
      })
      .finally(() => {
        if (isMounted) {
          setFetchingStatus(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleCopyFingerprint() {
    if (!fingerprint) return;
    try {
      await navigator.clipboard.writeText(fingerprint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API fails
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!licenseKey.trim()) {
      setError("Please enter a license key");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await activateLicense(licenseKey.trim(), customerName.trim());
      if (onActivated) {
        onActivated();
      }
    } catch (err) {
      setError(err.message || "Activation failed");
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
          maxWidth: "460px",
          ...styles.card,
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.25rem",
          }}
        >
          <div>
            <h2 style={{ ...styles.pageTitle, fontSize: "1.5rem", margin: 0 }}>
              Device Activation
            </h2>
            <p
              style={{
                margin: "0.25rem 0 0",
                fontSize: "0.9rem",
                color: colors.muted,
              }}
            >
              This device is not activated
            </p>
          </div>
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

        <div
          style={{
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            borderRadius: "8px",
            padding: "1rem",
            marginBottom: "1.25rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: colors.muted,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "0.4rem",
            }}
          >
            Your Device Fingerprint
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "1.35rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: colors.ink,
              wordBreak: "break-all",
              userSelect: "all",
            }}
          >
            {fetchingStatus ? "Loading..." : fingerprint || "Unavailable"}
          </div>
          {fingerprint && (
            <button
              type="button"
              onClick={handleCopyFingerprint}
              style={{
                marginTop: "0.5rem",
                background: "transparent",
                border: "none",
                color: colors.primary,
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                padding: "0.2rem 0.5rem",
              }}
            >
              {copied ? "✓ Copied to clipboard" : "📋 Copy Fingerprint"}
            </button>
          )}
        </div>

        <label style={{ display: "block", marginBottom: "0.75rem", ...styles.label }}>
          Customer / Shop Name (Optional)
          <input
            type="text"
            value={customerName}
            placeholder="e.g. Ali General Store"
            onChange={(event) => setCustomerName(event.target.value)}
            style={{
              ...styles.input,
              marginTop: "0.5rem",
            }}
          />
        </label>

        <label style={{ display: "block", marginBottom: "1rem", ...styles.label }}>
          License Key
          <input
            type="text"
            value={licenseKey}
            placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
            onChange={(event) => setLicenseKey(event.target.value)}
            style={{
              ...styles.input,
              marginTop: "0.5rem",
              fontFamily: "monospace",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          />
        </label>

        {error ? (
          <p style={{ color: colors.danger, marginBottom: "1rem", fontSize: "0.9rem" }}>
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading || fetchingStatus}
          style={{
            ...styles.buttonPrimary,
            width: "100%",
            backgroundColor: loading ? colors.muted : colors.primary,
          }}
        >
          {loading ? "Activating..." : "Activate"}
        </button>
      </form>
    </div>
  );
}
