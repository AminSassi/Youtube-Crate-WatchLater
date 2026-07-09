export function SignInScreen({ onSignIn, authError }) {
  return (
    <div style={{
      minHeight: "100vh", background: "#080810", color: "#e2e2f0",
      fontFamily: "'DM Sans',system-ui,sans-serif", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        maxWidth: 420, width: "100%", textAlign: "center", border: "1px solid #1c1c2e",
        borderRadius: 22, padding: 36, background: "#0d0d16",
      }}>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 10 }}>
          Sign in to Video Vault
        </div>
        <div style={{ color: "#9090b8", marginBottom: 24 }}>
          Your saved videos are stored in Firestore. Please sign in with Google to access them.
        </div>
        <button
          onClick={onSignIn}
          style={{
            width: "100%", padding: "12px 18px", borderRadius: 12,
            border: "none", background: "linear-gradient(135deg,#4c8dff,#5aa4ff)",
            color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}
        >
          Sign in with Google
        </button>
        {authError && (
          <div style={{ marginTop: 16, color: "#ff6b8a", fontSize: 13 }}>{authError}</div>
        )}
        <div style={{ marginTop: 22, fontSize: 12, color: "#50507a" }}>
          If you're already signed in, reload the page after signing in.
        </div>
      </div>
    </div>
  );
}
