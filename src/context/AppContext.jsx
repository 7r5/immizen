import { createContext, useContext, useReducer, useEffect } from "react";
import { login } from "../api/immich";

const AppContext = createContext(null);

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

    login(serverUrl, email, password)
      .then((token) => dispatch({ type: "AUTH_SUCCESS", token }))
      .catch((err) => dispatch({ type: "AUTH_ERROR", error: err.message }));
  }, []);

  const navigate = (screen, params) =>
    dispatch({ type: "NAVIGATE", screen, params });
  const goBack = () => dispatch({ type: "GO_BACK" });

  return (
    <AppContext.Provider value={{ ...state, navigate, goBack }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
