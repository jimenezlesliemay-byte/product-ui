import { useEffect, useState } from "react";
import api, { saveTokens, clearTokens } from "./api";

function Login({ onLogin }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/login", form);
      saveTokens(data.tokens);
      onLogin();
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form onSubmit={submit} className="card auth-card">
        <h2>Welcome Back</h2>
        <p className="subtitle">Log in to manage your products</p>
        {error && <p className="error">{error}</p>}
        <input placeholder="Username" value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        <input type="password" placeholder="Password" value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
    </div>
  );
}

const empty = { product_name: "", description: "", price: "", quantity: "" };

function Products({ onLogout }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const logout = async () => {
    const refresh = localStorage.getItem("refresh_token");
    clearTokens();
    onLogout();
    try { await api.post("/api/auth/logout", { refresh_token: refresh }); } catch {}
  };

  const load = async () => {
    try {
      const { data } = await api.get("/api/products");
      setProducts(data.data);
    } catch (err) {
      if (err.response?.status === 401) logout();
    }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const payload = { ...form };
    const editing = editingId;

    // 1) Ipakita agad sa screen
    if (editing) {
      setProducts((prev) => prev.map((p) => (p.id === editing ? { ...p, ...payload } : p)));
    } else {
      setProducts((prev) => [...prev, { id: "tmp-" + Date.now(), ...payload, _pending: true }]);
    }
    setForm(empty);
    setEditingId(null);

    // 2) I-save sa server sa background
    try {
      if (editing) await api.put(`/api/products/${editing}`, payload);
      else await api.post("/api/products", payload);
      load(); // kunin ang tunay na ID at petsa
    } catch (err) {
      setError(err.response?.data?.error || "Save failed");
      setForm(payload);
      load(); // ibalik sa tunay na laman ng database
    }
  };

  const edit = (p) => {
    setEditingId(p.id);
    setForm({ product_name: p.product_name, description: p.description || "", price: p.price, quantity: p.quantity });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id) => {
    if (!confirm("Delete this product?")) return;
    setProducts((prev) => prev.filter((p) => p.id !== id)); // mawawala agad
    try {
      await api.delete(`/api/products/${id}`);
    } catch {
      setError("Delete failed");
      load();
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <h2>Product List</h2>
        <button className="btn-ghost" onClick={logout}>Logout</button>
      </div>

      <form onSubmit={submit} className="card product-form">
        <h3>{editingId ? "Edit Product" : "Add Product"}</h3>
        {error && <p className="error">{error}</p>}
        <div className="form-grid">
          <input className="full" placeholder="Product name" value={form.product_name}
            onChange={(e) => setForm({ ...form, product_name: e.target.value })} required />
          <input className="full" placeholder="Description" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input type="number" step="0.01" placeholder="Price" value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })} required />
          <input type="number" placeholder="Quantity" value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn-primary">{editingId ? "Update" : "Add Product"}</button>
          {editingId && (
            <button type="button" className="btn-ghost"
              onClick={() => { setEditingId(null); setForm(empty); }}>Cancel</button>
          )}
        </div>
      </form>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th><th>Name</th><th>Description</th><th>Price</th>
              <th>Qty</th><th>Created At</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr><td colSpan="7" className="empty">No products yet.</td></tr>
            )}
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p._pending ? "…" : p.id}</td>
                <td>{p.product_name}</td>
                <td>{p.description}</td>
                <td>{Number(p.price).toFixed(2)}</td>
                <td>{p.quantity}</td>
                <td>
                  {p._pending
                    ? "Saving..."
                    : p.created_at ? new Date(p.created_at.replace(" ", "T")).toLocaleString() : ""}
                </td>
                <td>
                  <div className="actions">
                    <button className="btn-ghost btn-sm" disabled={p._pending} onClick={() => edit(p)}>Edit</button>
                    <button className="btn-danger btn-sm" disabled={p._pending} onClick={() => remove(p.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem("access_token"));
  return loggedIn
    ? <Products onLogout={() => setLoggedIn(false)} />
    : <Login onLogin={() => setLoggedIn(true)} />;
}