import { useCallback, useEffect, useState } from "react";
import { api } from "./client";

export function useServices() {
  const [state, setState] = useState({ error: null, loading: true, services: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api.services.list(controller.signal)
      .then((services) => setState({ error: null, loading: false, services }))
      .catch((error) => {
        if (error.name !== "AbortError") {
          setState({ error, loading: false, services: [] });
        }
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ error: null, loading: true, services: [] });
    setAttempt((current) => current + 1);
  }, []);

  return { ...state, retry };
}
