import { useState } from "react";
import { api } from "../api";

export function AuthPage({ setToken }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = isLogin ? { email, password } : { name, email, password };
      const res = isLogin ? await api.login(payload) : await api.register(payload);
      
      if (res.token) {
        localStorage.setItem("token", res.token);
        // Optionally store user info like name
        if (res.user?.name) localStorage.setItem("userName", res.user.name);
        setToken(res.token);
      }
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "100px auto", padding: 20, border: "1px solid #ccc", borderRadius: 8 }}>
      <h2>{isLogin ? "Login to FlowLedger" : "Register for FlowLedger"}</h2>
      {error && <div style={{ color: "red", marginBottom: 10 }}>{error}</div>}
      
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
        {!isLogin && (
          <div>
            <label>Name</label><br/>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required style={{ width: "100%", padding: 8 }} />
          </div>
        )}
        <div>
          <label>Email</label><br/>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: "100%", padding: 8 }} />
        </div>
        <div>
          <label>Password</label><br/>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: "100%", padding: 8 }} />
        </div>
        <button type="submit" disabled={loading} style={{ padding: 10, background: "#007BFF", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
          {loading ? "Please wait..." : (isLogin ? "Login" : "Register")}
        </button>
      </form>

      <div style={{ marginTop: 20, textAlign: "center" }}>
        <button 
          onClick={() => { setIsLogin(!isLogin); setError(""); }} 
          style={{ background: "none", border: "none", color: "#007BFF", textDecoration: "underline", cursor: "pointer" }}
        >
          {isLogin ? "Need an account? Register" : "Already have an account? Login"}
        </button>
      </div>
    </div>
  );
}
