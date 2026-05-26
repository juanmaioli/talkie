# 🎙️ Plan de Implementación: Vox2Text

Vox2Text es una aplicación web local autohospedada que permite subir archivos de audio en formato MP3 y transcribirlos a texto en pantalla utilizando la tecnología **Whisper** de forma 100% local y privada, sin depender de servicios externos en la nube. La transcripción se genera con alta precisión utilizando el modelo **`medium`** de Whisper, y la aplicación ofrece herramientas avanzadas de accesibilidad (diseño adaptable con alto contraste y lectura en voz alta integrada) junto con la descarga de la transcripción en formato **Markdown (.md)**.

---

## 🛠️ Revisión del Usuario Requerida

> [!IMPORTANT]
> **Modelo Medium de Whisper:**
> El modelo `medium` pesa aproximadamente **1.5 GB** y requiere una cantidad considerable de memoria RAM y CPU para el procesamiento en tiempo real (usualmente entre 4 y 8 GB de RAM libres durante la ejecución). Dado que el sistema tiene `g++` y `make` instalados, la compilación de `whisper.cpp` será nativa y sumamente eficiente.
> 
> **Dependencias del Sistema:**
> El sistema ya cuenta con `ffmpeg` (versión 7.1.4), `make` (4.4.1) y `g++` (14.2.0) instalados, por lo que no es necesario instalar herramientas adicionales. Todo el proceso de descarga del modelo y compilación del motor se realizará de forma automática en los pasos de inicialización.

---

## ❓ Preguntas Abiertas

*Actualmente no hay preguntas abiertas, ya que definimos todos los detalles clave en la lluvia de ideas inicial.*

---

## 🏗️ Cambios Propuestos

El proyecto estará estructurado en un único directorio con un servidor backend en **Node.js (Express)** y un frontend SPA dinámico y accesible con **Bootstrap 5.3** (tema oscuro por defecto).

```
Vox2Text/
├── whisper.cpp/          [NUEVO] Repositorio clonado y compilado localmente
│   ├── main              [NUEVO] Binario ejecutable compilado
│   └── models/
│       └── ggml-medium.bin  [NUEVO] Archivo del modelo Whisper medium (~1.5 GB)
├── uploads/              [NUEVO] Directorio temporal para archivos subidos
├── public/               [NUEVO] Archivos estáticos del frontend
│   ├── index.html        [NUEVO] Interfaz web accesible SPA
│   ├── app.js            [NUEVO] Lógica del cliente, Text-to-Speech y descargas
│   └── styles.css        [NUEVO] Estilos de accesibilidad, contrastes y animaciones
├── server.js             [NUEVO] Servidor Express, endpoints de subida, conversión y transcripción
├── package.json          [NUEVO] Configuración del proyecto de Node.js y dependencias
├── .gitignore            [NUEVO] Exclusiones de Git (uploads, modelos pesados y GEMINI.md)
└── README.md             [NUEVO] Documentación completa del proyecto
```

---

### 1. ⚙️ Backend (Servidor y Transcripción)

#### [NEW] [package.json](file:///home/juan/Documentos/Dev/Apps/Vox2Text/package.json)
Configuración de Node.js con Express, Multer (para subida de archivos) y variables de entorno.
- Dependencias: `express`, `multer`, `cors`, `dotenv`.

#### [NEW] [server.js](file:///home/juan/Documentos/Dev/Apps/Vox2Text/server.js)
Servidor Express centralizado que gestionará:
- Configuración de la carga de archivos MP3.
- Conversión automática del MP3 a un archivo WAV temporal a 16kHz mono de 16 bits usando `ffmpeg` por línea de comandos.
- Llamada al binario ejecutable de `whisper.cpp` para procesar el archivo de audio con el modelo `medium` y generar la transcripción.
- Envío de la transcripción de regreso al cliente.
- Limpieza automática de archivos de audio temporales tras procesar la petición.

#### [NEW] [.gitignore](file:///home/juan/Documentos/Dev/Apps/Vox2Text/.gitignore)
Excluye carpetas de Node.js, el directorio `uploads` temporales, los binarios pesados compilados de `whisper.cpp`, los archivos `.bin` de modelos, y el archivo `GEMINI.md` de control de versiones.

---

### 2. 🎨 Frontend (Interfaz de Usuario Accesible)

#### [NEW] [index.html](file:///home/juan/Documentos/Dev/Apps/Vox2Text/public/index.html)
Interfaz web interactiva diseñada bajo pautas de accesibilidad (**A11y**):
- Implementación de **Bootstrap 5.3** con tema oscuro nativo y alto contraste.
- Estructura semántica accesible (roles ARIA, etiquetas `label` explícitas, estados de foco perceptibles).
- Formulario de subida de MP3 con soporte de arrastrar y soltar (drag and drop) completamente operable mediante teclado.
- Indicador de estado claro y animado durante el proceso de transcripción.
- Contenedor de transcripción destacado, visible y legible.

#### [NEW] [app.js](file:///home/juan/Documentos/Dev/Apps/Vox2Text/public/app.js)
Lógica del lado del cliente:
- Manejo del formulario de subida mediante `fetch`.
- **Text-to-Speech (Síntesis de Voz):** Implementación de la API de síntesis de voz nativa del navegador para leer el texto en voz alta con controles de reproducción (Iniciar, Pausar, Detener) y control de velocidad de voz.
- **Descarga de Markdown (.md):** Generación y descarga dinámica del archivo formateado en Markdown estructurado con títulos y emojis.
- **Copiar al Portapapeles:** Copia rápida con indicador visual de éxito y aviso compatible con lectores de pantalla.

#### [NEW] [styles.css](file:///home/juan/Documentos/Dev/Apps/Vox2Text/public/styles.css)
Estilos complementarios y mejoras visuales:
- Variables personalizadas de color para el modo oscuro con alto contraste.
- Bordes de foco mejorados para una fácil navegación por teclado.
- Animaciones fluidas para la barra de estado y los estados de carga.

---

## 🧪 Plan de Verificación

### Pruebas Automatizadas y Diagnóstico
1. **Compilación de Whisper.cpp:** Ejecutaremos el script de compilación local y verificaremos que el binario `./main` se genere correctamente y sea ejecutable.
2. **Descarga del Modelo:** Verificaremos la correcta descarga del modelo `medium` en `./models/ggml-medium.bin`.
3. **Conversión con FFmpeg:** Realizaremos una prueba de línea de comandos simulando la conversión de un audio de prueba para garantizar que FFmpeg produce el WAV de 16kHz mono esperado por Whisper.

### Pruebas Manuales
1. **Subida y Transcripción:** Iniciar el servidor local (`npm run dev`), subir un MP3 de prueba corto desde el navegador y verificar que la transcripción se imprima en pantalla de forma fluida.
2. **Accesibilidad:** Comprobar la navegabilidad por teclado (tecla Tab, barras de foco) y probar el lector de síntesis de voz integrado.
3. **Descarga Markdown:** Descargar el archivo `.md` resultante y validar su correcto formateo en un lector de Markdown.
