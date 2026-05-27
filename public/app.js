document.addEventListener('DOMContentLoaded', () => {
  // Elementos del DOM
  const dropZone = document.getElementById('drop-zone');
  const audioInput = document.getElementById('audio-input');
  const selectFileBtn = document.getElementById('select-file-btn');
  
  const fileInfo = document.getElementById('file-info');
  const fileNameDisplay = document.getElementById('file-name');
  const fileSizeDisplay = document.getElementById('file-size');
  
  const transcribeBtn = document.getElementById('transcribe-btn');
  const removeFileBtn = document.getElementById('remove-file-btn');
  
  const progressSection = document.getElementById('progress-section');
  const progressBar = document.getElementById('progress-bar');
  const progressStatus = document.getElementById('progress-status');
  const progressPercent = document.getElementById('progress-percent');
  
  const resultSection = document.getElementById('result-section');
  const transcriptionText = document.getElementById('transcription-text');
  const copyBtn = document.getElementById('copy-btn');
  const copyBtnText = document.getElementById('copy-btn-text');
  const downloadBtn = document.getElementById('download-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const newTranscriptionBtn = document.getElementById('new-transcription-btn');
  const themeSwitch = document.getElementById('theme-switch');

  // Elementos de la Nota Inteligente con IA
  const rawTab = document.getElementById('raw-tab');
  const aiTab = document.getElementById('ai-tab');
  const aiPlaceholder = document.getElementById('ai-placeholder');
  const generateAiBtn = document.getElementById('generate-ai-btn');
  const aiLoading = document.getElementById('ai-loading');
  const cancelAiBtn = document.getElementById('cancel-ai-btn');
  const aiResult = document.getElementById('ai-result');
  const copyAiBtn = document.getElementById('copy-ai-btn');
  const copyAiBtnText = document.getElementById('copy-ai-btn-text');
  const downloadAiBtn = document.getElementById('download-ai-btn');
  const aiText = document.getElementById('ai-text');
  
  // Elementos de la Sección de YouTube
  const youtubeUrlInput = document.getElementById('youtube-url');
  const youtubeBtn = document.getElementById('youtube-btn');
  const modelSelect = document.getElementById('model-select');
  const youtubeSectionCard = document.querySelector('.youtube-section');
  
  let selectedFile = null;
  let youtubeVideoTitle = '';
  let transcribeAbortController = null;
  let aiAbortController = null;
  let progressInterval = null;
  let rawTranscriptionText = '';

  // --- GESTIÓN DE TEMA CLARO/OSCURO ---
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-bs-theme', savedTheme);
  if (themeSwitch) {
    themeSwitch.checked = savedTheme === 'dark';
  }

  if (themeSwitch) {
    themeSwitch.addEventListener('change', () => {
      const newTheme = themeSwitch.checked ? 'dark' : 'light';
      document.documentElement.setAttribute('data-bs-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      console.log(`[Tema] Cambiado a modo ${newTheme}.`);
    });
  }

  // --- GESTIÓN DE ARCHIVOS Y DRAG & DROP ---

  // Abrir selector al hacer clic
  dropZone.addEventListener('click', () => audioInput.click());
  selectFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    audioInput.click();
  });

  // Operabilidad por teclado (Enter o Espacio sobre dropzone)
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      audioInput.click();
    }
  });

  // Eventos de arrastre
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    }, false);
  });

  // Procesar archivo soltado
  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleAudioFile(files[0]);
    }
  });

  // Procesar archivo seleccionado
  audioInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleAudioFile(e.target.files[0]);
    }
  });

  // Validar y cargar archivo
  function handleAudioFile(file) {
    if (file.type !== 'audio/mpeg' && !file.name.endsWith('.mp3')) {
      alert('Por favor, selecciona un archivo de audio en formato MP3.');
      return;
    }
    
    selectedFile = file;
    fileNameDisplay.textContent = file.name;
    fileSizeDisplay.textContent = formatBytes(file.size);
    
    // Mostrar info de archivo y ocultar dropzone
    fileInfo.classList.remove('d-none');
    dropZone.classList.add('d-none');
  }

  // Quitar archivo
  removeFileBtn.addEventListener('click', () => {
    selectedFile = null;
    audioInput.value = '';
    fileInfo.classList.add('d-none');
    dropZone.classList.remove('d-none');
    dropZone.focus();
  });

  // Formatear tamaño de archivos
  function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  // --- PROCESAMIENTO Y TRANSCRIPCIÓN ---

  transcribeBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    const modelSelect = document.getElementById('model-select');
    const selectedModel = modelSelect ? modelSelect.value : 'medium';

    // Mostrar progreso y ocultar carga
    fileInfo.classList.add('d-none');
    progressSection.classList.remove('d-none');
    
    // Iniciar barra de progreso inteligente simulada
    let progress = 0;
    progressBar.style.width = '0%';
    progressPercent.textContent = '0%';
    progressStatus.textContent = 'Convirtiendo formato de audio...';

    transcribeAbortController = new AbortController();

    progressInterval = setInterval(() => {
      if (progress < 90) {
        // Incremento decreciente para dar sensación real
        const increment = (90 - progress) * 0.05;
        progress += Math.max(0.5, increment);
        const displayProgress = Math.round(progress);
        
        progressBar.style.width = `${displayProgress}%`;
        progressBar.setAttribute('aria-valuenow', displayProgress);
        progressPercent.textContent = `${displayProgress}%`;
        
        if (progress > 15 && progress < 45) {
          progressStatus.textContent = 'Analizando espectro de audio (FFmpeg)...';
        } else if (progress >= 45 && progress < 80) {
          progressStatus.textContent = `Transcribiendo con Whisper local (Modelo ${selectedModel === 'base' ? 'Base' : selectedModel === 'small' ? 'Small' : 'Medium'})...`;
        } else if (progress >= 80) {
          progressStatus.textContent = 'Generando texto final. Casi listo...';
        }
      }
    }, 1500);

    const formData = new FormData();
    formData.append('audio', selectedFile);
    formData.append('model', selectedModel);

    try {
      const response = await fetch('/transcribe', {
        method: 'POST',
        body: formData,
        signal: transcribeAbortController.signal
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ocurrió un error al procesar la transcripción.');
      }

      const result = await response.json();
      
      // Completar barra al 100%
      clearInterval(progressInterval);
      progressBar.style.width = '100%';
      progressBar.setAttribute('aria-valuenow', 100);
      progressPercent.textContent = '100%';
      progressStatus.textContent = 'Transcripción completada con éxito!';

      setTimeout(() => {
        progressSection.classList.add('d-none');
        resultSection.classList.remove('d-none');
        
        // Cargar texto y guardar crudo
        rawTranscriptionText = result.transcription;
        transcriptionText.innerHTML = escapeHtml(rawTranscriptionText);
        transcriptionText.focus();
      }, 800);

    } catch (error) {
      clearInterval(progressInterval);
      
      // Si el error es por abortar la petición, no mostramos un mensaje de error molesto
      if (error.name === 'AbortError') {
        console.log('[Cliente] Transcripción abortada por el usuario.');
        return;
      }
      
      progressSection.classList.add('d-none');
      fileInfo.classList.remove('d-none');
      alert(`Error: ${error.message}`);
    }
  });

  // Cancelar procesamiento
  cancelBtn.addEventListener('click', () => {
    if (transcribeAbortController) {
      transcribeAbortController.abort(); // Cancela la petición fetch
      console.log('[Cliente] Petición de abortar enviada al servidor.');
    }
    
    if (progressInterval) {
      clearInterval(progressInterval);
    }
    
    // Habilitar elementos nuevamente
    dropZone.classList.remove('disabled-element');
    youtubeSectionCard.classList.remove('disabled-element');
    if (modelSelect) modelSelect.classList.remove('disabled-element');
    
    progressSection.classList.add('d-none');
    if (selectedFile) {
      fileInfo.classList.remove('d-none');
    } else {
      dropZone.classList.remove('d-none');
    }
  });

  // --- TRANSCRIPCIÓN DESDE YOUTUBE ---
  if (youtubeBtn) {
    youtubeBtn.addEventListener('click', async () => {
      const url = youtubeUrlInput.value.trim();
      if (!url) {
        alert('Por favor, ingresá una URL de YouTube.');
        return;
      }

      // Validar formato básico de URL
      if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
        alert('Por favor, ingresá una URL válida de YouTube.');
        return;
      }

      const selectedModel = modelSelect ? modelSelect.value : 'small';

      // Deshabilitar los formularios de subida para evitar concurrencia
      dropZone.classList.add('disabled-element');
      youtubeSectionCard.classList.add('disabled-element');
      if (modelSelect) modelSelect.classList.add('disabled-element');

      // Ocultar info de archivos si hubiera y mostrar sección de progreso
      fileInfo.classList.add('d-none');
      dropZone.classList.add('d-none');
      progressSection.classList.remove('d-none');

      // Iniciar barra de progreso inteligente simulada para YouTube
      let progress = 0;
      progressBar.style.width = '0%';
      progressBar.setAttribute('aria-valuenow', 0);
      progressPercent.textContent = '0%';
      progressStatus.textContent = 'Obteniendo metadatos del video...';

      transcribeAbortController = new AbortController();

      progressInterval = setInterval(() => {
        if (progress < 90) {
          const increment = (90 - progress) * 0.04;
          progress += Math.max(0.4, increment);
          const displayProgress = Math.round(progress);

          progressBar.style.width = `${displayProgress}%`;
          progressBar.setAttribute('aria-valuenow', displayProgress);
          progressPercent.textContent = `${displayProgress}%`;

          if (progress > 5 && progress < 30) {
            progressStatus.textContent = 'Descargando audio de YouTube en el servidor...';
          } else if (progress >= 30 && progress < 55) {
            progressStatus.textContent = 'Convirtiendo pista de audio con FFmpeg...';
          } else if (progress >= 55 && progress < 85) {
            progressStatus.textContent = `Transcribiendo con Whisper local (Modelo ${selectedModel === 'base' ? 'Base' : selectedModel === 'small' ? 'Small' : 'Medium'})...`;
          } else if (progress >= 85) {
            progressStatus.textContent = 'Estructurando transcripción. Casi listo...';
          }
        }
      }, 1500);

      try {
        const response = await fetch('/transcribe-youtube', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url, model: selectedModel }),
          signal: transcribeAbortController.signal
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Ocurrió un error al procesar el video de YouTube.');
        }

        const result = await response.json();

        // Completar barra
        clearInterval(progressInterval);
        progressBar.style.width = '100%';
        progressBar.setAttribute('aria-valuenow', 100);
        progressPercent.textContent = '100%';
        progressStatus.textContent = '¡Video transcrito con éxito!';

        // Guardar título de video
        youtubeVideoTitle = result.title || '';

        setTimeout(() => {
          progressSection.classList.add('d-none');
          resultSection.classList.remove('d-none');

          // Habilitar elementos nuevamente
          dropZone.classList.remove('disabled-element');
          youtubeSectionCard.classList.remove('disabled-element');
          if (modelSelect) modelSelect.classList.remove('disabled-element');

          // Cargar transcripción
          rawTranscriptionText = result.transcription;
          transcriptionText.innerHTML = escapeHtml(rawTranscriptionText);
          transcriptionText.focus();
        }, 800);

      } catch (error) {
        clearInterval(progressInterval);

        // Habilitar elementos nuevamente
        dropZone.classList.remove('disabled-element');
        youtubeSectionCard.classList.remove('disabled-element');
        if (modelSelect) modelSelect.classList.remove('disabled-element');

        if (error.name === 'AbortError') {
          console.log('[Cliente] Transcripción de YouTube abortada por el usuario.');
          return;
        }

        progressSection.classList.add('d-none');
        dropZone.classList.remove('d-none');
        alert(`Error de YouTube: ${error.message}`);
      }
    });
  }

  // Sanitizar HTML para inyectar seguro
  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }

  // --- ACCIONES DE RESULTADO (COPIAR Y DESCARGAR) ---

  // Copiar al portapapeles
  copyBtn.addEventListener('click', () => {
    const text = transcriptionText.textContent;
    navigator.clipboard.writeText(text).then(() => {
      copyBtnText.textContent = '¡Copiado!';
      copyBtn.classList.replace('btn-outline-light', 'btn-success');
      
      setTimeout(() => {
        copyBtnText.textContent = 'Copiar';
        copyBtn.classList.replace('btn-success', 'btn-outline-light');
      }, 2500);
    }).catch(err => {
      console.error('Error al copiar texto: ', err);
    });
  });

  // Descarga en Markdown (.md)
  downloadBtn.addEventListener('click', () => {
    const text = transcriptionText.textContent;
    
    // Generar formato Markdown hermoso y estructurado
    const modelSelect = document.getElementById('model-select');
    const selectedModel = modelSelect ? modelSelect.value : 'medium';
    const modelLabel = selectedModel === 'base' ? 'Base' : selectedModel === 'small' ? 'Small' : 'Medium';
    
    let markdownContent = '';
    let baseName = 'transcripcion';
    
    if (youtubeVideoTitle) {
      baseName = youtubeVideoTitle.toLowerCase().replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').substring(0, 100);
      markdownContent = text; // Si es YouTube, la cabecera completa ya está inyectada en el crudo
    } else {
      const audioName = selectedFile ? selectedFile.name : 'audio.mp3';
      baseName = audioName.substring(0, audioName.lastIndexOf('.')) || audioName;
      
      markdownContent = `# 🎙️ Transcripción: ${audioName}\n\n` +
                        `Documento generado automáticamente de forma 100% local por la aplicación **Talkie** utilizando el modelo **Whisper ${modelLabel}**.\n\n` +
                        `--- \n\n` +
                        `## 📝 Contenido Transcrito\n\n` +
                        `${text}\n\n` +
                        `--- \n` +
                        `*Fin de la transcripción.*\n`;
    }

    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.setAttribute('download', `${baseName}_transcripcion.md`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // Cargar una nueva transcripción
  newTranscriptionBtn.addEventListener('click', () => {
    selectedFile = null;
    audioInput.value = '';
    rawTranscriptionText = '';
    youtubeVideoTitle = '';
    if (youtubeUrlInput) {
      youtubeUrlInput.value = '';
    }
    
    // Habilitar elementos nuevamente
    dropZone.classList.remove('disabled-element');
    youtubeSectionCard.classList.remove('disabled-element');
    if (modelSelect) {
      modelSelect.classList.remove('disabled-element');
    }
    
    if (aiAbortController) {
      aiAbortController.abort();
    }

    // Ocultar sección de resultados y restablecer a la pantalla inicial
    resultSection.classList.add('d-none');
    fileInfo.classList.add('d-none');
    dropZone.classList.remove('d-none');
    
    // Restablecer pestañas y estado de IA
    if (rawTab) {
      rawTab.click();
    }
    aiPlaceholder.classList.remove('d-none');
    aiLoading.classList.add('d-none');
    aiResult.classList.add('d-none');
    aiText.textContent = '';

    // Enfocar zona de arrastre para accesibilidad por teclado
    dropZone.focus();
  });

  // --- GESTIÓN DE NOTAS INTELIGENTES CON IA ---

  // Generar nota estructurada con IA
  generateAiBtn.addEventListener('click', async () => {
    if (!rawTranscriptionText || rawTranscriptionText.trim() === '') {
      alert('No hay texto disponible para procesar.');
      return;
    }

    aiPlaceholder.classList.add('d-none');
    aiLoading.classList.remove('d-none');
    aiResult.classList.add('d-none');

    aiAbortController = new AbortController();

    try {
      const response = await fetch('/format-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: rawTranscriptionText }),
        signal: aiAbortController.signal
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ocurrió un error al formatear el texto con la IA.');
      }

      const result = await response.json();
      
      aiLoading.classList.add('d-none');
      aiResult.classList.remove('d-none');

      // Inyectar el texto en el visor. Al usar textContent mantenemos el Markdown limpio para copiar y descargar.
      aiText.textContent = result.formattedText;
      aiText.focus();

    } catch (error) {
      aiLoading.classList.add('d-none');
      
      if (error.name === 'AbortError') {
        console.log('[Cliente] Procesamiento de IA abortado por el usuario.');
        aiPlaceholder.classList.remove('d-none');
        return;
      }

      aiPlaceholder.classList.remove('d-none');
      alert(`Error al procesar con IA: ${error.message}`);
    }
  });

  // Cancelar procesamiento de IA
  cancelAiBtn.addEventListener('click', () => {
    if (aiAbortController) {
      aiAbortController.abort();
      console.log('[Cliente] Petición de abortar IA enviada.');
    }
    aiLoading.classList.add('d-none');
    aiPlaceholder.classList.remove('d-none');
  });

  // Copiar nota estructurada al portapapeles
  copyAiBtn.addEventListener('click', () => {
    const text = aiText.textContent;
    navigator.clipboard.writeText(text).then(() => {
      copyAiBtnText.textContent = '¡Copiada!';
      copyAiBtn.classList.replace('btn-outline-light', 'btn-success');
      
      setTimeout(() => {
        copyAiBtnText.textContent = 'Copiar Nota';
        copyAiBtn.classList.replace('btn-success', 'btn-outline-light');
      }, 2500);
    }).catch(err => {
      console.error('Error al copiar la nota: ', err);
    });
  });

  // Descargar nota estructurada en Markdown (.md)
  downloadAiBtn.addEventListener('click', () => {
    const text = aiText.textContent;
    let baseName = 'nota_inteligente';
    
    if (youtubeVideoTitle) {
      baseName = youtubeVideoTitle.toLowerCase().replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').substring(0, 100);
    } else {
      const audioName = selectedFile ? selectedFile.name : 'audio.mp3';
      baseName = audioName.substring(0, audioName.lastIndexOf('.')) || audioName;
    }

    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.setAttribute('download', `${baseName}_nota_inteligente.md`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
});
