# Mi Ganado

App para llevar el inventario de tu hato: registro de animales con arete, raza, sexo, peso, edad y estado de salud (Saludable, Sobrepeso, Bajo peso, Enferma, Vendida).

## Requisitos

- Node.js 18 o superior instalado (https://nodejs.org)

## Cómo correr el proyecto en tu computador

1. Descomprime este proyecto en una carpeta.
2. Abre una terminal dentro de esa carpeta.
3. Instala las dependencias:

   ```bash
   npm install
   ```

4. Inicia el servidor de desarrollo:

   ```bash
   npm run dev
   ```

5. Abre en el navegador la dirección que aparece en la terminal (normalmente `http://localhost:5173`).

## Dónde se guardan los datos

Los datos se guardan en el `localStorage` del navegador donde abras la app. Eso significa:

- Los datos **persisten** aunque cierres el navegador o apagues el computador.
- Los datos están ligados a ese navegador y ese computador específico (no se sincronizan entre dispositivos).
- Si borras el historial/caché del navegador o usas modo incógnito, los datos se pueden perder.
- Para tener un respaldo real, exporta los datos periódicamente (o pide que se agregue una función de exportar/importar a Excel o JSON).

## Cómo publicarla gratis en internet (para usarla desde el celular)

1. Sube este proyecto a un repositorio de GitHub.
2. Genera la versión de producción:

   ```bash
   npm run build
   ```

3. Despliega la carpeta `dist` gratis en [Vercel](https://vercel.com), [Netlify](https://netlify.com) o GitHub Pages.
4. Una vez publicada, podrás abrir la app desde el navegador de tu celular. Recuerda que, al ser `localStorage`, los datos quedan guardados en el navegador de cada dispositivo donde la abras, no se comparten automáticamente entre el computador y el celular.

## Estructura del proyecto

```
mi-ganado/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx     # punto de entrada de React
    ├── App.jsx       # toda la lógica y la interfaz de la app
    └── index.css     # estilos base de Tailwind
```
