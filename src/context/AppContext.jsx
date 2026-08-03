import { createContext, useContext, useReducer, useEffect } from "react";
import { login } from "../api/immich";

const AppContext = createContext(null);
const BACK_KEYS = new Set([10009, 461]);

function exitApplication() {
  try {
    const application =
      globalThis.tizen?.application?.getCurrentApplication?.();
    if (application?.exit) {
      application.exit();
      return;
    }
  } catch (error) {
    console.warn("Unable to close the Tizen application cleanly.", error);
  }

  if (globalThis.history?.length > 1) globalThis.history.back();
  else globalThis.close?.();
}

const initialState = {
  status: "connecting", // 'connecting' | 'ready' | 'error'
  token: null,
  serverUrl: import.meta.env.VITE_IMMICH_URL || "",
  error: null,
  currentScreen: "albums",
  screenParams: {},
  history: [],
};

function reducer(state, action) {
  switch (action.type) {
    case "AUTH_SUCCESS":
      return { ...state, status: "ready", token: action.token, error: null };
    case "AUTH_ERROR":
      return { ...state, status: "error", error: action.error };
    case "NAVIGATE":
      if (action.screen === state.currentScreen) {
        return { ...state, screenParams: action.params ?? state.screenParams };
      }
      return {
        ...state,
        history: [
          ...state.history,
          { screen: state.currentScreen, params: state.screenParams },
        ],
        currentScreen: action.screen,
        screenParams: action.params ?? {},
      };
    case "GO_BACK": {
      if (state.history.length === 0) return state;
      const prev = state.history[state.history.length - 1];
      return {
        ...state,
        history: state.history.slice(0, -1),
        currentScreen: prev.screen,
        screenParams: prev.params,
      };
    }
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const serverUrl = import.meta.env.VITE_IMMICH_URL;
    const email = import.meta.env.VITE_IMMICH_EMAIL;
    const password = import.meta.env.VITE_IMMICH_PASSWORD;

    if (!serverUrl || !email || !password) {
      dispatch({
        type: "AUTH_ERROR",
        error:
          "Missing VITE_IMMICH_URL, VITE_IMMICH_EMAIL, or VITE_IMMICH_PASSWORD.",
      });
      return;
    }

    login(serverUrl, email, password)
      .then((token) => dispatch({ type: "AUTH_SUCCESS", token }))
      .catch((err) => dispatch({ type: "AUTH_ERROR", error: err.message }));
  }, []);

  useEffect(() => {
    if (state.status === "ready") return undefined;
    const handleBack = (event) => {
      if (!BACK_KEYS.has(event.keyCode)) return;
      event.preventDefault();
      exitApplication();
    };
    window.addEventListener("keydown", handleBack);
    return () => window.removeEventListener("keydown", handleBack);
  }, [state.status]);

  const navigate = (screen, params) =>
    dispatch({ type: "NAVIGATE", screen, params });
  const goBack = () => {
    if (state.history.length === 0) exitApplication();
    else dispatch({ type: "GO_BACK" });
  };

  return (
    <AppContext.Provider value={{ ...state, navigate, goBack }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
