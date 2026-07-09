import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
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
              Something went wrong
            </div>
            <div style={{ color: "#9090b8", marginBottom: 24 }}>
              The app encountered an unexpected error. Try refreshing the page.
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                width: "100%", padding: "12px 18px", borderRadius: 12,
                border: "none", background: "linear-gradient(135deg,#ff4d6d,#d42f4e)",
                color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              Refresh page
            </button>
            <div style={{ marginTop: 22, fontSize: 12, color: "#50507a" }}>
              {this.state.error?.message || "Unknown error"}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
