import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { AuthContext } from "./context";

export default function AuthProvider({ children }) {
  const [identity, setIdentity] = useState(null);
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    const controller = new AbortController();
    api.auth.current(controller.signal)
      .then((currentIdentity) => {
        setIdentity(currentIdentity);
        setStatus("authenticated");
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setIdentity(null);
        setStatus(error.status === 401 ? "anonymous" : "unavailable");
      });
    return () => controller.abort();
  }, []);

  const login = useCallback(async (input) => {
    const currentIdentity = await api.auth.login(input);
    setIdentity(currentIdentity);
    setStatus("authenticated");
    return currentIdentity;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch (error) {
      if (error.status !== 401) throw error;
    }
    setIdentity(null);
    setStatus("anonymous");
  }, []);

  const invalidateSession = useCallback(() => {
    setIdentity(null);
    setStatus("anonymous");
  }, []);

  const retrySession = useCallback(async () => {
    setStatus("checking");
    try {
      const currentIdentity = await api.auth.current();
      setIdentity(currentIdentity);
      setStatus("authenticated");
    } catch (error) {
      setIdentity(null);
      setStatus(error.status === 401 ? "anonymous" : "unavailable");
    }
  }, []);

  const value = useMemo(
    () => ({ identity, invalidateSession, login, logout, retrySession, status }),
    [identity, invalidateSession, login, logout, retrySession, status],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
