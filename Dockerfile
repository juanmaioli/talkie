# Usar la imagen base oficial de Node 22 en Alpine
FROM node:22-alpine

# Definir variables de entorno para producción
ENV NODE_ENV=production \
    PORT=3000 \
    YT_DLP_PATH=/usr/bin/yt-dlp

# Establecer el directorio de trabajo
WORKDIR /app

# Instalar dependencias de ejecución indispensables del sistema
# - ffmpeg: Para conversiones de audio a WAV a 16kHz
# - yt-dlp: Extraer audio de YouTube
# - python3: Requerido por yt-dlp
# - ca-certificates: Para conexiones seguras HTTPS a la API de Gemini
# - libstdc++: Requerida por whisper-cli compilado
RUN apk add --no-cache \
    ffmpeg \
    yt-dlp \
    python3 \
    ca-certificates \
    libstdc++

# Copiar archivos de definición de dependencias de Node.js
COPY package*.json ./

# Instalar dependencias de producción de Node.js
RUN npm ci --only=production

# Copiar todo el código de la aplicación (excluyendo lo declarado en .dockerignore)
COPY . .

# Compilar Whisper.cpp nativamente en el entorno Alpine
# Se instalan herramientas de desarrollo de forma virtual y se descartan en la misma capa
# para mantener la imagen final extremadamente liviana y optimizada.
RUN apk add --no-cache --virtual .build-deps build-base cmake git && \
    cd whisper.cpp && \
    cmake -B build -DCMAKE_BUILD_TYPE=Release && \
    cmake --build build --config Release -j$(nproc) && \
    apk del .build-deps && \
    # Limpiar archivos de objetos y compilación residuales para ahorrar espacio
    find build -name "*.o" -type f -delete

# Crear directorio de subidas temporales y configurar los permisos correctos
RUN mkdir -p uploads && chmod 777 uploads

# Exponer el puerto del servidor de la aplicación
EXPOSE 3000

# Ejecutar la aplicación en modo de inicio de producción
CMD ["node", "server.js"]
