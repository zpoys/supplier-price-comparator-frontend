import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ChakraProvider, ColorModeScript, extendTheme } from "@chakra-ui/react";
import App from "./App";
import Login from "./Login";
import { AuthProvider, GuestOnly, RequireAuth } from "./auth";
import "./styles.css";

const theme = extendTheme({
  config: { initialColorMode: "light", useSystemColorMode: true },
  colors: {
    brand: {
      50: "#fff1f1",
      100: "#ffe0e0",
      200: "#ffc2c2",
      300: "#ff9999",
      400: "#fa7777",
      500: "#f16363",
      600: "#e54646",
      700: "#ca3838",
      800: "#a92d2d",
      900: "#7f2424",
    },
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 600,
        _focusVisible: {
          boxShadow: "0 0 0 3px var(--chakra-colors-brand-200)",
        },
        _disabled: { opacity: 0.45, cursor: "not-allowed" },
      },
      variants: {
        outline: (props: { colorMode: string; colorScheme?: string }) => ({
          color: props.colorMode === "dark" ? "gray.100" : "gray.700",
          borderColor:
            props.colorMode === "dark" ? "whiteAlpha.300" : "gray.300",
          bg: "transparent",
          _hover: {
            bg: props.colorMode === "dark" ? "whiteAlpha.100" : "gray.50",
            borderColor:
              props.colorMode === "dark" ? "whiteAlpha.500" : "gray.400",
            _disabled: { bg: "transparent" },
          },
          _active: {
            bg: props.colorMode === "dark" ? "whiteAlpha.200" : "gray.100",
          },
        }),
        ghost: (props: { colorMode: string; colorScheme?: string }) => ({
          color: props.colorScheme
            ? props.colorMode === "dark"
              ? `${props.colorScheme}.300`
              : `${props.colorScheme}.600`
            : props.colorMode === "dark"
              ? "gray.100"
              : "gray.700",
          _hover: {
            bg: props.colorMode === "dark" ? "whiteAlpha.100" : "gray.100",
            _disabled: { bg: "transparent" },
          },
          _active: {
            bg: props.colorMode === "dark" ? "whiteAlpha.200" : "gray.200",
          },
        }),
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route
              path="/login"
              element={
                <GuestOnly>
                  <Login />
                </GuestOnly>
              }
            />
            <Route element={<RequireAuth />}>
              <Route path="/" element={<App />} />
              <Route path="/target-types/*" element={<App />} />
              <Route path="/providers/*" element={<App />} />
              <Route path="/products/*" element={<App />} />
              <Route path="/suppliers/*" element={<App />} />
              <Route path="/product-suppliers/*" element={<App />} />
              <Route path="*" element={<App />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ChakraProvider>
  </React.StrictMode>,
);
