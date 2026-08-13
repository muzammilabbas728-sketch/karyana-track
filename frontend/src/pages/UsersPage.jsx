import { useState, useEffect } from "react";
import { getUsers, createUser, changeUserPin } from "../api/client";
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
    </section>
  );
}
