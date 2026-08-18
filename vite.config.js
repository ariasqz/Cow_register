import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: reemplaza "cow-register" por el nombre EXACTO de tu repositorio
// en GitHub (ej. si tu repo se llama "cow-register-app", pon "/cow-register-app/").
export default defineConfig({
  plugins: [react()],
  base: "/Cow-register/",
});
