const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Habilitar CORS y JSON
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de Multer para la subida de archivos temporales
const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  limits: {
    fileSize: 100 * 1024 * 1024, // Limite de 100MB por archivo
  },
  fileFilter: (req, file, cb) => {
    // Validar tipo MIME
    if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/mp3' || file.originalname.endsWith('.mp3')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de audio MP3.'));
    }
  }
});

// Ruta para procesar la transcripción
app.post('/transcribe', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo de audio.' });
  }

  const mp3Path = req.file.path;
  const tempId = Date.now();
  const wavPath = path.join(__dirname, 'uploads', `audio-${tempId}.wav`);
  const outputBase = path.join(__dirname, 'uploads', `transcription-${tempId}`);
  const outputTxtPath = `${outputBase}.txt`;

  let currentFFmpegProcess = null;
  let currentWhisperProcess = null;
  let requestAborted = false;

  console.log(`[${new Date().toLocaleTimeString()}] Recibido archivo MP3: ${req.file.originalname}`);

  // Escuchar evento de cierre de petición (cancelación del cliente)
  req.on('close', () => {
    if (!requestAborted) {
      requestAborted = true;
      console.log(`[${new Date().toLocaleTimeString()}] ⏹️ Petición cancelada por el cliente. Abortando procesos...`);
      
      if (currentFFmpegProcess) {
        try {
          currentFFmpegProcess.kill('SIGKILL');
          console.log('[Cancelación] Proceso FFmpeg abortado con éxito.');
        } catch (err) {
          console.error('[Cancelación] Error al abortar FFmpeg:', err.message);
        }
      }
      
      if (currentWhisperProcess) {
        try {
          currentWhisperProcess.kill('SIGKILL');
          console.log('[Cancelación] Proceso Whisper abortado con éxito.');
        } catch (err) {
          console.error('[Cancelación] Error al abortar Whisper:', err.message);
        }
      }
      
      cleanupFiles([mp3Path, wavPath, outputTxtPath]);
    }
  });

  // 1. Convertir MP3 a WAV mono de 16kHz utilizando FFmpeg
  const ffmpegCmd = `ffmpeg -i "${mp3Path}" -ar 16000 -ac 1 -c:a pcm_s16le "${wavPath}" -y`;
  
  console.log(`[${new Date().toLocaleTimeString()}] Convirtiendo MP3 a WAV a 16kHz mono...`);
  
  currentFFmpegProcess = exec(ffmpegCmd, (ffmpegErr, stdout, stderr) => {
    currentFFmpegProcess = null;
    if (requestAborted) return;

    if (ffmpegErr) {
      console.error('Error al convertir audio con FFmpeg:', ffmpegErr);
      cleanupFiles([mp3Path, wavPath]);
      return res.status(500).json({ error: 'Error interno en la conversión de audio.' });
    }

    let selectedModel = 'ggml-small.bin';
    let modelName = 'Small';
    if (req.body.model === 'base') {
      selectedModel = 'ggml-base.bin';
      modelName = 'Base';
    } else if (req.body.model === 'medium') {
      selectedModel = 'ggml-medium.bin';
      modelName = 'Medium';
    }
    console.log(`[${new Date().toLocaleTimeString()}] Conversión completada. Ejecutando Whisper local con modelo ${modelName}...`);

    // 2. Ejecutar Whisper.cpp local con el modelo seleccionado
    const whisperBin = path.join(__dirname, 'whisper.cpp', 'build', 'bin', 'whisper-cli');
    const modelPath = path.join(__dirname, 'whisper.cpp', 'models', selectedModel);
    
    // Fuerza el español (-l es) y descarta metadatos de marcas de tiempo en el output TXT por simplicidad (-otxt)
    const whisperCmd = `"${whisperBin}" -m "${modelPath}" -f "${wavPath}" -l es -otxt -of "${outputBase}"`;

    currentWhisperProcess = exec(whisperCmd, (whisperErr, whisperStdout, whisperStderr) => {
      currentWhisperProcess = null;
      if (requestAborted) return;

      if (whisperErr) {
        console.error('Error al transcribir con Whisper:', whisperErr);
        cleanupFiles([mp3Path, wavPath, outputTxtPath]);
        return res.status(500).json({ error: 'Error en el motor local de transcripción. ¿Está descargado el modelo?' });
      }

      console.log(`[${new Date().toLocaleTimeString()}] Transcripción completada exitosamente.`);

      // 3. Leer el texto generado
      fs.readFile(outputTxtPath, 'utf8', (readErr, data) => {
        if (requestAborted) return;

        // Limpiar todos los archivos temporales creados
        cleanupFiles([mp3Path, wavPath, outputTxtPath]);

        if (readErr) {
          console.error('Error al leer el archivo de transcripción:', readErr);
          return res.status(500).json({ error: 'Error al recuperar el texto transcrito.' });
        }

        // Devolver el texto limpio
        const text = data.trim();
        res.json({ transcription: text });
      });
    });
  });
});

// Función de utilidad para eliminar archivos temporales
function cleanupFiles(paths) {
  paths.forEach(p => {
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
        console.log(`[Limpieza] Eliminado archivo temporal: ${path.basename(p)}`);
      } catch (err) {
        console.error(`[Limpieza] Error al eliminar ${p}:`, err.message);
      }
    }
  });
}

// Endpoint para estructurar y traducir con Ollama (IA) bajo demanda
app.post('/format-ai', (req, res) => {
  const { text } = req.body;
  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'No se proporcionó texto para formatear.' });
  }

  let requestAborted = false;
  let ollamaReq = null;

  console.log(`[${new Date().toLocaleTimeString()}] Recibida solicitud de formateo inteligente con IA.`);

  // Escuchar cancelación del cliente
  req.on('close', () => {
    if (!requestAborted) {
      requestAborted = true;
      console.log(`[${new Date().toLocaleTimeString()}] ⏹️ Petición de IA cancelada por el cliente. Abortando solicitud a Ollama...`);
      if (ollamaReq) {
        try {
          ollamaReq.destroy();
          console.log('[Cancelación] Solicitud a Ollama abortada con éxito.');
        } catch (err) {
          console.error('[Cancelación] Error al abortar la solicitud a Ollama:', err.message);
        }
      }
    }
  });

  // Agente HTTPS que ignora certificados locales autofirmados para el contenedor Docker
  const agent = new https.Agent({
    rejectUnauthorized: false
  });

  // Prompt en español de Argentina estricto y estructurado de acuerdo con la elección del usuario
  const promptDefinido = `Actuá como un transcriptor profesional y redactor de notas de alta calidad. Tu tarea es procesar el siguiente texto transcrito.

Seguí estrictamente estas directrices:
1. Traducí el texto completo de su idioma original al español de Argentina (es_AR) de forma sumamente natural, fluida y con excelente gramática.
2. Formateá y estructurá la información utilizando la siguiente estructura en Markdown:
   - Un título principal en H1 (ej. "# 🎙️ Título del Audio") que comience con un emoji representativo y relevante según el contenido.
   - Un apartado de "Resumen ejecutivo" corto, redactado en un único párrafo conciso y con todo el texto en negrita.
   - Un apartado de "Temas clave" que consiste en una lista numerada de los puntos principales (1., 2., 3., etc.). Cada punto debe iniciar con un emoji descriptivo y representativo del tema en cuestión.
   - Un apartado de "Tareas pendientes" con una lista de casillas de verificación de Markdown de tipo "- [ ]" que enumere las acciones futuras, compromisos o tareas pendientes que se mencionaron en el texto. Si no se menciona ninguna tarea pendiente en el audio, creá al menos dos tareas hipotéticas, coherentes y lógicas que sirvan como próximos pasos recomendados basados en el contenido expuesto.

Texto original a procesar:
"${text}"`;

  const postData = JSON.stringify({
    model: 'gemma4:latest',
    prompt: promptDefinido,
    stream: false
  });

  const options = {
    hostname: 'drawers.docker',
    port: 11434,
    path: '/api/generate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    },
    agent: agent,
    timeout: 120000 // Timeout de 2 minutos para procesamiento de LLM
  };

  console.log(`[${new Date().toLocaleTimeString()}] Enviando prompt a Ollama en drawers.docker:11434 con el modelo 'gemma4:latest'...`);

  ollamaReq = https.request(options, (ollamaRes) => {
    let rawData = '';

    ollamaRes.on('data', (chunk) => {
      rawData += chunk;
    });

    ollamaRes.on('end', () => {
      if (requestAborted) return;

      if (ollamaRes.statusCode >= 400) {
        console.error(`Ollama respondió con código de estado ${ollamaRes.statusCode}`);
        return res.status(502).json({ error: `Ollama local devolvió un error (Código: ${ollamaRes.statusCode}).` });
      }

      try {
        const parsed = JSON.parse(rawData);
        const formattedText = parsed.response;
        console.log(`[${new Date().toLocaleTimeString()}] Nota estructurada generada exitosamente por la IA.`);
        res.json({ formattedText });
      } catch (err) {
        console.error('Error al parsear la respuesta JSON de Ollama:', err);
        res.status(502).json({ error: 'La respuesta de Ollama no pudo ser procesada.' });
      }
    });
  });

  ollamaReq.on('error', (err) => {
    if (requestAborted) return;
    console.error('Error de red al conectar con Ollama:', err);
    res.status(502).json({ error: 'No se pudo establecer conexión con Ollama en https://drawers.docker:11434. Asegurate de que el contenedor Docker esté corriendo.' });
  });

  ollamaReq.on('timeout', () => {
    if (requestAborted) return;
    console.log(`[${new Date().toLocaleTimeString()}] ⏱️ La solicitud a Ollama ha excedido el tiempo de espera.`);
    ollamaReq.destroy();
    res.status(504).json({ error: 'La solicitud a Ollama excedió el tiempo límite de espera.' });
  });

  ollamaReq.write(postData);
  ollamaReq.end();
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🎙️  Servidor de Talkie iniciado exitosamente`);
  console.log(`🔗  Disponible localmente en: http://localhost:${PORT}`);
  console.log(`==================================================`);
});
