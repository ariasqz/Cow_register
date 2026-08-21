import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// El nombre de tu repositorio en GitHub es "Cow_register" (con guion bajo,
// C mayúscula). Este valor DEBE coincidir exactamente con eso.
export default defineConfig({
  plugins: [react()],
  base: "/Cow_register/",
});
