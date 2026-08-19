import { useState, useEffect } from "react";
import {
  getUsers,
  createUser,
  changeUserPin,
  resetDemoData,
  getBackupDownloadUrl,
  restoreDatabase,
} from "../api/client";
import { colors, fonts, styles } from "../theme";

const initialNewUser = {
  name: "",
  username: "",
  pin: "",
  role: "staff",
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState(initialNewUser);
  const [pinChangeUserId, setPinChangeUserId] = useState(null);
  const [newPin, setNewPin] = useState("");
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [selectedRestoreFile, setSelectedRestoreFile] = useState(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(Date.now());

  useEffect(() => {
    async function loadUsers() {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      try {
        const data = await getUsers();
        setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || "Failed to load users");
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []);

  function clearMessages() {
    setError(null);
    setSuccessMessage(null);
  }

  function handleNewUserChange(event) {
    const { name, value } = event.target;
    setNewUser((current) => ({ ...current, [name]: value }));
  }

  async function handleAddUser(event) {
    event.preventDefault();
    clearMessages();

    if (!newUser.pin || newUser.pin.length < 4) {
      setError("PIN must be at least 4 characters long.");
      return;
    }

    try {
      const createdUser = await createUser({
        name: newUser.name.trim(),
        username: newUser.username.trim(),
        pin: newUser.pin,
        role: newUser.role,
      });
      setUsers((current) => [...current, createdUser]);
      setNewUser(initialNewUser);
      setShowAddForm(false);
      setSuccessMessage("User created successfully.");
    } catch (err) {
      setError(err.message || "Failed to create user");
    }
  }

  function startChangePin(user) {
    clearMessages();
    setPinChangeUserId(user.id);
    setNewPin("");
  }

  async function handleChangePinSubmit(event) {
    event.preventDefault();
    clearMessages();

    if (!newPin || newPin.length < 4) {
      setError("New PIN must be at least 4 characters long.");
      return;
    }

    try {
      await changeUserPin(pinChangeUserId, newPin);
      setSuccessMessage("PIN updated successfully.");
      setPinChangeUserId(null);
      setNewPin("");
    } catch (err) {
      setError(err.message || "Failed to update PIN");
    }
  }

  async function handleRestoreDatabase(event) {
    event.preventDefault();
    clearMessages();

    if (!selectedRestoreFile) {
      setError("Please select a SQLite backup file (.db) to restore.");
      return;
    }

    const confirmed = window.confirm(
      "WARNING: Restoring will overwrite ALL current database data (products, sales, customers, suppliers, settings) with the contents of this backup file.\n\nThis action cannot be undone.\n\nAre you sure you want to proceed?"
    );

    if (!confirmed) {
      return;
    }

    setRestoreLoading(true);
    try {
      const response = await restoreDatabase(selectedRestoreFile);
      setSuccessMessage(
        response?.detail ||
          "Database restored successfully. Please restart the backend server manually for changes to take effect."
      );
      setSelectedRestoreFile(null);
      setFileInputKey(Date.now());
    } catch (err) {
      setError(err.message || "Failed to restore database backup.");
    } finally {
      setRestoreLoading(false);
    }
  }

  async function handleResetData(event) {
    event.preventDefault();
    clearMessages();

    if (resetConfirmText !== "RESET") {
      setError("You must type RESET to confirm demo data deletion.");
      return;
    }

    const confirmed = window.confirm(
      "Are you absolutely sure you want to delete all demo data?\n\nThis will permanently delete all products, sales, customers, suppliers, purchases, investments, and stock adjustments. User accounts will be preserved.\n\nClick OK to confirm deletion."
    );

    if (!confirmed) {
      return;
    }

    setResetLoading(true);
    try {
      const response = await resetDemoData();
      setSuccessMessage(response?.detail || "All business data has been reset. User accounts were preserved.");
      setResetConfirmText("");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setError(err.message || "Failed to reset demo data.");
    } finally {
      setResetLoading(false);
    }
  }

  const selectedUser = users.find((u) => u.id === pinChangeUserId);

  return (
    <section
      style={{
        ...styles.card,
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ ...styles.pageTitle, fontSize: "1.4rem", margin: 0 }}>Users</h2>
        <button
          type="button"
          onClick={() => {
            clearMessages();
            setShowAddForm((current) => !current);
            if (showAddForm) {
              setNewUser(initialNewUser);
            }
          }}
          style={{
            ...styles.buttonPrimary,
          }}
        >
          {showAddForm ? "Cancel" : "Add User"}
        </button>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        {error ? <p style={{ color: colors.danger, margin: 0 }}>{error}</p> : null}
        {successMessage ? <p style={{ color: colors.primary, margin: 0 }}>{successMessage}</p> : null}
      </div>

      {showAddForm ? (
        <form
          onSubmit={handleAddUser}
          style={{
            display: "grid",
            gap: "0.75rem",
            marginBottom: "1rem",
            ...styles.card,
          }}
        >
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <label style={styles.label}>
              Name
              <input
                name="name"
                value={newUser.name}
                onChange={handleNewUserChange}
                required
                style={{
                  ...styles.input,
                  marginTop: "0.35rem",
                }}
              />
            </label>
            <label style={styles.label}>
              Username
              <input
                name="username"
                value={newUser.username}
                onChange={handleNewUserChange}
                required
                style={{
                  ...styles.input,
                  marginTop: "0.35rem",
                }}
              />
            </label>
            <label style={styles.label}>
              PIN (min 4 chars)
              <input
                name="pin"
                type="password"
                value={newUser.pin}
                onChange={handleNewUserChange}
                required
                minLength={4}
                style={{
                  ...styles.input,
                  marginTop: "0.35rem",
                }}
              />
            </label>
            <label style={styles.label}>
              Role
              <select
                name="role"
                value={newUser.role}
                onChange={handleNewUserChange}
                style={{
                  ...styles.input,
                  marginTop: "0.35rem",
                }}
              >
                <option value="staff">Staff</option>
                <option value="owner">Owner</option>
              </select>
            </label>
          </div>
          <div>
            <button type="submit" style={styles.buttonPrimary}>
              Save User
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p style={{ fontFamily: fonts.body, color: colors.muted }}>Loading users...</p>
      ) : users.length === 0 ? (
        <p style={{ fontFamily: fonts.body, color: colors.muted }}>No users found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                <th style={styles.tableHeaderCell}>Name</th>
                <th style={styles.tableHeaderCell}>Username</th>
                <th style={styles.tableHeaderCell}>Role</th>
                <th style={styles.tableHeaderCell}>Created</th>
                <th style={styles.tableHeaderCell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <td style={styles.tableCell}>{user.name}</td>
                  <td style={styles.tableCell}>{user.username}</td>
                  <td style={styles.tableCell}>{user.role}</td>
                  <td style={styles.tableCell}>
                    {user.created_at ? new Date(user.created_at).toLocaleString() : "—"}
                  </td>
                  <td style={styles.tableCell}>
                    <button
                      type="button"
                      onClick={() => startChangePin(user)}
                      style={styles.buttonSecondary}
                    >
                      Change PIN
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pinChangeUserId !== null ? (
        <div
          style={{
            marginTop: "1rem",
            ...styles.card,
          }}
        >
          <h3 style={{ ...styles.pageTitle, fontSize: "1.1rem", marginTop: 0 }}>
            Change PIN {selectedUser ? `for ${selectedUser.username}` : ""}
          </h3>
          <form onSubmit={handleChangePinSubmit} style={{ display: "grid", gap: "0.75rem", maxWidth: "300px" }}>
            <label style={styles.label}>
              New PIN
              <input
                type="password"
                value={newPin}
                onChange={(event) => setNewPin(event.target.value)}
                required
                minLength={4}
                style={{
                  ...styles.input,
                  marginTop: "0.35rem",
                }}
              />
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="submit" style={styles.buttonPrimary}>
                Submit
              </button>
              <button
                type="button"
                onClick={() => {
                  setPinChangeUserId(null);
                  setNewPin("");
                }}
                style={styles.buttonSecondary}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div
        style={{
          marginTop: "2rem",
          ...styles.cardAccent(colors.danger),
        }}
      >
        <h3 style={{ ...styles.pageTitle, fontSize: "1.2rem", color: colors.danger, marginTop: 0 }}>
          Danger Zone
        </h3>

        {/* Database Backup & Restore Section */}
        <div style={{ marginBottom: "2rem", borderBottom: `1px solid ${colors.border}`, paddingBottom: "1.5rem" }}>
          <h4 style={{ ...styles.pageTitle, fontSize: "1.05rem", marginTop: "0.5rem", marginBottom: "0.5rem" }}>
            Database Backup & Restore
          </h4>

          <div style={{ marginBottom: "1.5rem" }}>
            <p style={{ fontFamily: fonts.body, fontSize: "0.9rem", color: colors.ink, marginBottom: "0.75rem" }}>
              Download a complete snapshot of your current database (<code style={{ background: colors.bg, padding: "0.15rem 0.35rem", borderRadius: "4px" }}>karyana_track.db</code>) to keep a secure offline copy.
            </p>
            <a
              href={getBackupDownloadUrl()}
              download
              style={{
                ...styles.buttonSecondary,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              📥 Download Backup (.db)
            </a>
          </div>

          <div
            style={{
              padding: "1rem",
              background: "rgba(220, 38, 38, 0.05)",
              border: `1px solid rgba(220, 38, 38, 0.2)`,
              borderRadius: "8px",
            }}
          >
            <h5 style={{ ...styles.pageTitle, fontSize: "0.95rem", color: colors.danger, margin: "0 0 0.4rem 0" }}>
              Restore from Backup
            </h5>
            <p style={{ fontFamily: fonts.body, fontSize: "0.85rem", color: colors.ink, marginBottom: "0.75rem" }}>
              <strong style={{ color: colors.danger }}>Warning:</strong> Restoring will overwrite <strong>ALL</strong> current data with the uploaded file. You must restart the backend server after restoring.
            </p>
            <form onSubmit={handleRestoreDatabase} style={{ display: "grid", gap: "0.75rem", maxWidth: "450px" }}>
              <input
                key={fileInputKey}
                type="file"
                accept=".db,application/x-sqlite3,application/vnd.sqlite3"
                onChange={(e) => setSelectedRestoreFile(e.target.files?.[0] || null)}
                style={{
                  ...styles.input,
                  padding: "0.4rem",
                  fontSize: "0.85rem",
                }}
              />
              <div>
                <button
                  type="submit"
                  disabled={!selectedRestoreFile || restoreLoading}
                  style={{
                    ...styles.buttonDanger,
                    opacity: selectedRestoreFile && !restoreLoading ? 1 : 0.5,
                    cursor: selectedRestoreFile && !restoreLoading ? "pointer" : "not-allowed",
                  }}
                >
                  {restoreLoading ? "Restoring..." : "Restore Database"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Reset Demo Data Section */}
        <div>
          <h4 style={{ ...styles.pageTitle, fontSize: "1.05rem", marginTop: 0, marginBottom: "0.5rem" }}>
            Reset Demo Data
          </h4>
          <p style={{ fontFamily: fonts.body, fontSize: "0.9rem", color: colors.ink, marginBottom: "1rem" }}>
            Resetting demo data will permanently delete all business data (products, sales, customers, suppliers, purchases, investments, stock adjustments). User accounts will be preserved.
          </p>
          <form onSubmit={handleResetData} style={{ display: "grid", gap: "0.75rem", maxWidth: "400px" }}>
            <label style={styles.label}>
              Type <strong style={{ color: colors.ink }}>RESET</strong> to confirm:
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="RESET"
                style={{
                  ...styles.input,
                  marginTop: "0.35rem",
                }}
              />
            </label>
            <div>
              <button
                type="submit"
                disabled={resetConfirmText !== "RESET" || resetLoading}
                style={{
                  ...styles.buttonDanger,
                  opacity: resetConfirmText === "RESET" && !resetLoading ? 1 : 0.5,
                  cursor: resetConfirmText === "RESET" && !resetLoading ? "pointer" : "not-allowed",
                }}
              >
                {resetLoading ? "Resetting..." : "Reset All Demo Data"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

