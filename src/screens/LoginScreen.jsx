import { useState } from "react";
import { C } from "../styles/theme";
import { supabase } from "../lib/supabase.js";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const inputStyle = {
    width: "100%", padding: "14px 18px", borderRadius: 14,
    border: `2.5px solid ${C.border}`, background: C.inputBg,
    fontSize: 15, fontWeight: 600, color: C.text, outline: "none", marginBottom: 14,
    fontFamily: "'Nunito', sans-serif", transition: "border-color 0.2s",
    boxSizing: "border-box", minHeight: 48,
  };

  const btnStyle = (enabled) => ({
    width: "100%", padding: "14px 24px", borderRadius: 14, border: "none",
    background: enabled ? C.accent : C.border,
    color: "white", fontWeight: 800, fontSize: 15,
    cursor: enabled ? "pointer" : "not-allowed",
    fontFamily: "'Nunito', sans-serif", transition: "filter 0.1s, transform 0.1s", minHeight: 52,
  });

  const handleMagicLink = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true); setError("");
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(), options: { emailRedirectTo: window.location.origin },
      });
      if (err) throw err;
      setSent(true);
    } catch (err) { setError(err.message || "Failed to send magic link"); }
    finally { setLoading(false); }
  };

  const handlePasswordSignIn = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true); setError("");
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) throw err;
    } catch (err) { setError(err.message || "Invalid email or password"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fade-in" style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: "48px 24px",
    }}>
      <div style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
        <img src="/icons/logo.png" alt="Piñata" style={{ width: 120, height: 120, marginBottom: 8 }} />
        <h1 style={{ fontSize: 22, fontWeight: 900, color: C.text, marginBottom: 8 }}>Piñata</h1>
        <p style={{ color: C.muted, fontSize: 15, fontWeight: 600, marginBottom: 36, lineHeight: 1.6 }}>
          Sign in to track your Spanish quiz scores
        </p>
        {sent ? (
          <div style={{
            background: C.successLight, border: `1px solid ${C.success}`, borderRadius: 14,
            padding: "24px 20px", textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✉️</div>
            <p style={{ fontWeight: 700, color: C.success, marginBottom: 4 }}>Check your email!</p>
            <p style={{ color: C.muted, fontSize: 14, fontWeight: 600 }}>
              We sent a magic link to <strong style={{ color: C.text }}>{email}</strong>
            </p>
            <button onClick={() => setSent(false)} style={{
              marginTop: 16, background: "none", border: "none", color: C.accent,
              fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Nunito', sans-serif",
            }}>Use a different email</button>
          </div>
        ) : (
          <form onSubmit={handlePasswordSignIn}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com" autoComplete="email" autoFocus style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = C.accent)}
              onBlur={(e) => (e.target.style.borderColor = C.border)} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Password" autoComplete="current-password" style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = C.accent)}
              onBlur={(e) => (e.target.style.borderColor = C.border)} />
            <button type="submit" disabled={loading || !email.trim() || !password}
              style={btnStyle(!loading && email.trim() && password)}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0", color: C.muted, fontSize: 13, fontWeight: 600 }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <span>or</span>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>
            <button type="button" onClick={handleMagicLink} disabled={loading || !email.trim()} style={{
              ...btnStyle(!loading && email.trim()), background: "none",
              border: `2.5px solid ${(!loading && email.trim()) ? C.accent : C.border}`,
              color: (!loading && email.trim()) ? C.accent : C.muted,
            }}>
              {loading ? "Sending..." : "Send Magic Link"}
            </button>
            {error && <p style={{ color: C.error, fontSize: 13, fontWeight: 600, marginTop: 12 }}>{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
