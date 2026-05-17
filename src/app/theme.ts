import { createTheme } from "@mui/material";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#176b87",
    },
    secondary: {
      main: "#9b287b",
    },
    background: {
      default: "#f5f7f9",
      paper: "#ffffff",
    },
    warning: {
      main: "#b26a00",
    },
  },
  shape: {
    borderRadius: 6,
  },
  typography: {
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
});
