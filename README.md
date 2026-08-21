# Cow Register

https://github.com/user-attachments/assets/ba56b3dc-46e3-469f-84f6-3784b86ba37f

## Problema

Muchos ganaderos pequeños y medianos todavía llevan el control de su hato en cuadernos físicos o de memoria: número de arete, raza, peso, estado de salud de cada animal. Esto hace difícil saber rápidamente cuántos animales hay, cuáles están enfermos, con sobrepeso o bajos de peso, y dificulta tomar decisiones a tiempo sobre su manejo. Además, no existe una forma sencilla y gratuita de tener esta información organizada y accesible desde cualquier dispositivo.

## Solución

Cow Register es una aplicación web gratuita y responsive donde el ganadero registra cada animal (arete, nombre, raza, sexo, edad, peso, notas) y la app clasifica automáticamente su estado de peso (Saludable, Sobrepeso o Bajo peso) según rangos de referencia por edad y sexo, ajustables por raza. La información queda guardada de forma persistente en el dispositivo, con un panel que resume de un vistazo el total de animales, cuántos están saludables y cuáles requieren atención.

### Guardado de datos
No hay backend ni base de datos externa. Todo se guarda en el `localStorage` del navegador donde se abre la app:
- Los datos persisten aunque se cierre el navegador o el computador.
- Quedan ligados a ese navegador/dispositivo específico — no se sincronizan solos entre el computador y el celular.
- Si se borra el historial/caché del navegador o se usa modo incógnito, los datos se pierden.

## Estructura del proyecto
 
```
cow-register/
├── .github/
│   └── workflows/
│       └── deploy.yml       # Publica la app en GitHub Pages con cada push a main
├── index.html                # Punto de entrada HTML
├── package.json
├── vite.config.js            # Configuración de Vite (incluye el "base" para GitHub Pages)
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx               # Monta la app de React en el DOM
    ├── App.jsx                 # Toda la lógica y la interfaz de la app
    └── index.css               # Estilos base de Tailwind
```
 
Todo el código funcional vive en un único archivo, `src/App.jsx`, organizado así internamente:
 
- **Constantes de estilo y datos** (`COLORS`, `WEIGHT_STATUS`, `FLAGS`, `DEFAULT_WEIGHT_RANGES`): paleta de colores y catálogos de estados.
- **Funciones puras de lógica** (`classifyWeight`, `ageCategory`, `ageFromDate`, `recomputeHerdStatuses`, `migrateCow`): calculan edad, categoría de etapa y estado de peso sin depender de React, lo que las hace fáciles de probar o reutilizar.
- **Componente principal** (`CowRegister`): guarda el estado de la app (hato, razas, filtros, formularios), carga y guarda en `localStorage`, y arma la pantalla (encabezado, buscador, cuadrícula de tarjetas, formulario modal).
- **Componentes de apoyo** (`CowCard`, `Field`, `EmptyState`, `BreedRangesModal`): piezas de interfaz reutilizadas dentro del componente principal.
## Cómo correrlo en tu computador
 
```bash
npm install
npm run dev
```
 
Abre la dirección que muestra la terminal (normalmente `http://localhost:5173`).
