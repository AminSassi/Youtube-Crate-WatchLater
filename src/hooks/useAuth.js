import { useState, useEffect, useCallback } from "react";
import { onAuthChange, signInWithGoogle, signOutUser, isConfigured } from "../services/firebase";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(isConfigured);

  useEffect(() => {
    if (!isConfigured) return;
    const unsub = onAuthChange(u => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = useCallback(async () => {
    setAuthError("");
    if (!isConfigured) {
      setAuthError("Firebase is not configured. Create a .env file with your Firebase credentials.");
      return;
    }
    try {
      await signInWithGoogle();
    } catch (err) {
      console.warn("Auth sign-in error:", err);
      setAuthError("Could not sign in. Try again.");
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.warn("Auth sign-out error:", err);
    }
  }, []);

  return { user, authError, loading, signIn, signOut };
}
