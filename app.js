const ANALYSIS_WINDOW = 2048;
const ENVELOPE_BINS = 96;
const MATCHES_LIMIT = 4;
const HISTORY_LIMIT = 12;
const DEFAULT_DETECTION_LIMITS = Object.freeze({
  minOnsetThreshold: 0.18,
  minSignalRms: 0.012,
  minSignalPeak: 0.045,
  minPeakRate: 0.45,
  minCapturePeaks: 3,
  minMatchConfidence: 28,
  minSignalQuality: 0.22,
  minOnsetContrast: 0.12,
  minCaptureFingerprints: 2,
  minRhythmicStability: 0.12,
  minMatchAbsoluteSimilarity: 0.38,
  minMatchEvidence: 0.42,
  minFingerprintVotes: 2,
  minFingerprintSimilarity: 0.08,
  minRhythmSimilarity: 0.36,
  minTopMatchMargin: 5,
});
const MODE_LIMIT_OVERRIDES = Object.freeze({
  field: {
    minMatchConfidence: 40,
    minSignalQuality: 0.35,
    minCaptureFingerprints: 8,
    minMatchAbsoluteSimilarity: 0.42,
    minMatchEvidence: 0.58,
    minFingerprintVotes: 6,
    minFingerprintSimilarity: 0.12,
    minRhythmSimilarity: 0.45,
    minTopMatchMargin: 10,
  },
});
const SUBSEQUENCE_STRIDE_DIVISOR = 18;
const CAPTURE_FRAME_SECONDS = 0.12;
const CAPTURE_WINDOW_SECONDS = [6, 8, 10, 12];
const MAX_CAPTURE_CANDIDATES = 9;
const REFERENCE_SEGMENT_SECONDS = [8, 10, 12];
const MAX_REFERENCE_SEGMENTS = 8;
const SPECTRAL_BAND_FREQUENCIES = [90, 140, 220, 320, 450, 650, 900, 1300];
const REFERENCE_SEGMENT_STRIDE_SECONDS = 2.5;
const SPECTRAL_LANDMARK_PEAKS_PER_FRAME = 2;
const SPECTRAL_LANDMARK_MIN_PEAK = 0.18;
const SPECTRAL_LANDMARK_LOOKAHEAD_FRAMES = 8;
const SPECTRAL_LANDMARK_MAX_NEIGHBORS = 4;
const FINGERPRINT_MAX_NEIGHBORS = 5;
const FINGERPRINT_MAX_INTERVAL_SECONDS = 3.2;
const FINGERPRINT_INTERVAL_STEP = 0.05;
const FINGERPRINT_OFFSET_STEP = 0.25;
const DEFAULT_TAG = "Sin etiqueta";
const AVAILABLE_TAGS = [
  "Sin etiqueta",
  "Oracion",
  "Llamada",
  "Procesion",
  "Recogida",
  "Marcha lenta",
  "Exhibicion",
];
const STORAGE_KEYS = {
  settings: "cofrabeat:settings",
  history: "cofrabeat:history",
  mode: "cofrabeat:mode",
  settingsVersion: "cofrabeat:settings-version",
};
const SETTINGS_SCHEMA_VERSION = 4;
const FEATURE_SCHEMA_VERSION = 5;
const DB_NAME = "cofrabeat-library";
const DB_VERSION = 2;
const DB_STORE_REFERENCES = "references";
const DB_STORE_METADATA = "metadata";
const DECODE_TIMEOUT_MS = 12000;
const AUDIO_WORKLET_MODULE = "./audio-recorder-worklet.js";
const GITHUB_PAGES_HOST_SUFFIX = ".github.io";

const MODE_PRESETS = {
  fast: {
    label: "Escucha rápida",
    weights: { fingerprint: 0.32, rhythm: 0.22, envelope: 0.08, interval: 0.16, density: 0.06, tempo: 0.06, peaks: 0.04, spectral: 0.06, flux: 0.06 },
  },
  field: {
    label: "Micro real",
    weights: { fingerprint: 0.06, rhythm: 0.27, envelope: 0.15, interval: 0.17, density: 0.03, tempo: 0.06, peaks: 0.01, spectral: 0.16, flux: 0.09 },
  },
  balanced: {
    label: "Equilibrado",
    weights: { fingerprint: 0.36, rhythm: 0.18, envelope: 0.08, interval: 0.18, density: 0.06, tempo: 0.06, peaks: 0.02, spectral: 0.06, flux: 0.06 },
  },
  strict: {
    label: "Más estricto",
    weights: { fingerprint: 0.42, rhythm: 0.16, envelope: 0.06, interval: 0.2, density: 0.04, tempo: 0.06, peaks: 0.02, spectral: 0.04, flux: 0.04 },
  },
};

const state = {
  audioContext: null,
  database: null,
  references: [],
  mediaStream: null,
  mediaSource: null,
  processor: null,
  analyser: null,
  recordingChunks: [],
  isListening: false,
  stopTimer: null,
  captureStartedAt: null,
  history: [],
  lastResult: null,
  settings: {
    captureSeconds: 10,
    minimumConfidence: 45,
    analysisMode: "field",
  },
  uiMode: "user",
  adminAuthenticated: false,
  adminActivePanel: "admin-panel",
  toastTimer: null,
  detectionLimits: { ...DEFAULT_DETECTION_LIMITS },
  adminFilters: {
    search: "",
    tag: "all",
  },
  collapsedReferences: new Set(),
  availableTags: [...AVAILABLE_TAGS],
  diagnostics: {
    commonEntries: 0,
    commonLoaded: 0,
    commonFailed: 0,
  },
};

const elements = {
  listenButton: document.querySelector("#listenButton"),
  listenLabel: document.querySelector("#listenLabel"),
  listenHint: document.querySelector("#listenHint"),
  meterFill: document.querySelector("#meterFill"),
  confidenceValue: document.querySelector("#confidenceValue"),
  statusPill: document.querySelector("#statusPill"),
  matchName: document.querySelector("#matchName"),
  matchMeta: document.querySelector("#matchMeta"),
  matchesList: document.querySelector("#matchesList"),
  libraryGrid: document.querySelector("#libraryGrid"),
  fileInput: document.querySelector("#fileInput"),
  dropZone: document.querySelector("#adminUploadSection"),
  confidenceRing: document.querySelector(".confidence-ring"),
  referenceCount: document.querySelector("#referenceCount"),
  historyCount: document.querySelector("#historyCount"),
  modeLabel: document.querySelector("#modeLabel"),
  modeStatusBadge: document.querySelector("#modeStatusBadge"),
  modeToggleButton: document.querySelector("#modeToggleButton"),
  capturedTempo: document.querySelector("#capturedTempo"),
  capturedPeaks: document.querySelector("#capturedPeaks"),
  micStatusLabel: document.querySelector("#micStatusLabel"),
  transportStatusLabel: document.querySelector("#transportStatusLabel"),
  captureDuration: document.querySelector("#captureDuration"),
  captureDurationValue: document.querySelector("#captureDurationValue"),
  minimumConfidence: document.querySelector("#minimumConfidence"),
  minimumConfidenceValue: document.querySelector("#minimumConfidenceValue"),
  analysisMode: document.querySelector("#analysisMode"),
  shareResultButton: document.querySelector("#shareResultButton"),
  repeatResultButton: document.querySelector("#repeatResultButton"),
  clearLibraryButton: document.querySelector("#clearLibraryButton"),
  librarySummary: document.querySelector("#librarySummary"),
  adminTotalAudios: document.querySelector("#adminTotalAudios"),
  adminFilteredAudios: document.querySelector("#adminFilteredAudios"),
  adminCommonStatus: document.querySelector("#adminCommonStatus"),
  adminCommonMessage: document.querySelector("#adminCommonMessage"),
  adminSearchInput: document.querySelector("#adminSearchInput"),
  adminTagFilter: document.querySelector("#adminTagFilter"),
  adminNewTagInput: document.querySelector("#adminNewTagInput"),
  adminAddTagButton: document.querySelector("#adminAddTagButton"),
  adminTagChips: document.querySelector("#adminTagChips"),
  adminMetadataStatus: document.querySelector("#adminMetadataStatus"),
  localModeBanner: document.querySelector("#localModeBanner"),
  localHelpButton: document.querySelector("#localHelpButton"),
  localHelpCard: document.querySelector("#localHelpCard"),
  runtimeInfo: document.querySelector("#runtimeInfo"),
  userBottomNav: document.querySelector(".bottom-nav.user-mode-section"),
  adminBottomNav: document.querySelector(".bottom-nav--admin"),
  detectSection: document.querySelector("#detectSection"),
  resultSection: document.querySelector("#resultSection"),
  controlsSection: document.querySelector("#controlsSection"),
  historySection: document.querySelector("#historySection"),
  adminSummarySection: document.querySelector("#adminSummarySection"),
  adminPanelSection: document.querySelector("#adminPanelSection"),
  adminToolsSection: document.querySelector("#adminToolsSection"),
  adminUploadSection: document.querySelector("#adminUploadSection"),
  adminLibrarySection: document.querySelector("#adminLibrarySection"),
  adminInfoSection: document.querySelector("#adminInfoSection"),
  adminSelectFilesButton: document.querySelector("#adminSelectFilesButton"),
  historyList: document.querySelector("#historyList"),
  clearHistoryButton: document.querySelector("#clearHistoryButton"),
  adminLoginModal: document.querySelector("#adminLoginModal"),
  adminLoginForm: document.querySelector("#adminLoginForm"),
  adminPasswordInput: document.querySelector("#adminPasswordInput"),
  adminLoginError: document.querySelector("#adminLoginError"),
  adminLoginSubmitButton: document.querySelector("#adminLoginSubmitButton"),
  adminLoginCancelButton: document.querySelector("#adminLoginCancelButton"),
  adminLoginCloseButton: document.querySelector("#adminLoginCloseButton"),
  appToast: document.querySelector("#appToast"),
  appToastTitle: document.querySelector("#appToastTitle"),
  appToastMessage: document.querySelector("#appToastMessage"),
  startupOverlay: document.querySelector("#startupOverlay"),
  startupCard: document.querySelector("#startupCard"),
  startupProgress: document.querySelector("#startupProgress"),
  startupTitle: document.querySelector("#startupTitle"),
  startupMeta: document.querySelector("#startupMeta"),
  startupProgressBar: document.querySelector("#startupProgressBar"),
  startupProgressLabel: document.querySelector("#startupProgressLabel"),
};

boot();

async function boot() {
  try {
    setAppLoadingState(true, {
      title: "Preparando detector",
      meta: "Cargando interfaz y comprobaciones básicas del dispositivo.",
      progress: 4,
    });
    await cleanupDevelopmentCaching();
    setAppLoadingState(true, {
      title: "Cargando entorno",
      meta: "Recuperando ajustes guardados y estado de la aplicación.",
      progress: 12,
    });
    renderRuntimeInfo();
    loadSavedState();
    await refreshAdminSession();
    bindEvents();
    setupMicrophonePermissionWatcher();
    setAppLoadingState(true, {
      title: "Comprobando micrófono",
      meta: "Verificando permisos y disponibilidad del dispositivo de entrada.",
      progress: 22,
    });
    await refreshMicrophoneStatus();
    syncSettingsUi();
    syncModeUi();
    setAppLoadingState(true, {
      title: "Cargando calibración",
      meta: "Aplicando límites y perfil de detección para el modo actual.",
      progress: 34,
    });
    await loadDetectionCalibration();
    updateStatus("idle", "Cargando referencias");
    setAppLoadingState(true, {
      title: "Recuperando biblioteca local",
      meta: "Leyendo referencias persistidas en este navegador.",
      progress: 48,
    });
    await loadPersistedReferences();
    setAppLoadingState(true, {
      title: "Cargando base común",
      meta: "Abriendo el manifest y preparando los audios compartidos.",
      progress: 62,
    });
    await loadManifestReferences();
    setAppLoadingState(true, {
      title: "Finalizando arranque",
      meta: "Actualizando interfaz y dejando la app lista para escuchar.",
      progress: 92,
    });
    renderAll();
    registerServiceWorker();
    if (isFileProtocol()) {
      elements.localModeBanner.hidden = false;
      elements.localHelpCard.hidden = false;
      updateStatus("ready", "Modo local");
      updateResult({
        name: "App cargada en modo local",
        meta: `Protocolo detectado: ${window.location.protocol}. Si abres con file://, la carga automática desde manifest.json y la instalación PWA quedan desactivadas. Puedes añadir mp3 manualmente en administración.`,
        confidence: 0,
        matches: [],
        analysis: null,
      });
      return;
    }

    updateStatus(
      state.references.length ? "ready" : "idle",
      state.references.length ? "Listo para escuchar" : "Sin referencias cargadas",
    );
  } catch (error) {
    console.error("Error durante el arranque", error);
    updateStatus("idle", "Error de arranque");
    updateResult({
      name: "No se pudo iniciar la app",
      meta: "Ha fallado la carga inicial de la biblioteca o de los ajustes. Recarga la pagina; si persiste, revisa la consola del navegador.",
      confidence: 0,
      matches: [],
      analysis: null,
    });
  } finally {
    setAppLoadingState(false);
  }
}

function bindEvents() {
  elements.listenButton.addEventListener("click", toggleListening);
  elements.modeToggleButton.addEventListener("click", toggleMode);
  elements.localHelpButton?.addEventListener("click", showLocalHelp);
  elements.userBottomNav?.addEventListener("click", handleBottomNav);
  elements.adminBottomNav?.addEventListener("click", handleBottomNav);
  elements.adminLoginForm?.addEventListener("submit", handleAdminLoginSubmit);
  elements.adminLoginCancelButton?.addEventListener("click", closeAdminLoginModal);
  elements.adminLoginCloseButton?.addEventListener("click", closeAdminLoginModal);
  elements.adminLoginModal?.addEventListener("click", (event) => {
    if (event.target === elements.adminLoginModal) {
      closeAdminLoginModal();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.adminLoginModal?.hidden) {
      closeAdminLoginModal();
    }
  });
  window.addEventListener("scroll", syncBottomNavByViewport, { passive: true });
  window.addEventListener("resize", syncBottomNavByViewport, { passive: true });
  elements.fileInput.addEventListener("change", async (event) => {
    const files = [...event.target.files];
    await loadFilesAsReferences(files);
    event.target.value = "";
  });

  if (elements.dropZone) {
    ["dragenter", "dragover"].forEach((eventName) => {
      elements.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        elements.dropZone.classList.add("is-active");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      elements.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        elements.dropZone.classList.remove("is-active");
      });
    });

    elements.dropZone.addEventListener("drop", async (event) => {
      const files = [...event.dataTransfer.files].filter((file) =>
        file.type.includes("audio") || file.name.toLowerCase().endsWith(".mp3"),
      );
      await loadFilesAsReferences(files);
    });
  }

  elements.captureDuration.addEventListener("input", () => {
    state.settings.captureSeconds = Number(elements.captureDuration.value);
    syncSettingsUi();
    persistSettings();
  });

  elements.minimumConfidence.addEventListener("input", () => {
    state.settings.minimumConfidence = Number(elements.minimumConfidence.value);
    syncSettingsUi();
    persistSettings();
    renderMatches(state.lastResult?.matches ?? []);
  });

  elements.analysisMode.addEventListener("change", () => {
    state.settings.analysisMode = elements.analysisMode.value;
    syncSettingsUi();
    persistSettings();
  });

  elements.shareResultButton.addEventListener("click", shareLastResult);
  elements.repeatResultButton.addEventListener("click", () => {
    if (!state.isListening) {
      toggleListening();
    }
  });

  elements.clearLibraryButton.addEventListener("click", clearLibrary);
  elements.clearHistoryButton.addEventListener("click", clearHistory);
  elements.adminSelectFilesButton?.addEventListener("click", () => {
    elements.fileInput?.click();
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-admin-open]");
    if (!button) {
      return;
    }

    openAdminPanel(button.dataset.adminOpen, {
      focusSearch: button.dataset.adminOpen === "admin-search",
    });
  });
  elements.adminSearchInput.addEventListener("input", () => {
    state.adminFilters.search = elements.adminSearchInput.value.trim().toLowerCase();
    renderLibrary();
  });
  elements.adminTagFilter.addEventListener("change", () => {
    state.adminFilters.tag = elements.adminTagFilter.value;
    renderLibrary();
  });
  elements.adminAddTagButton?.addEventListener("click", addAdminTag);
  elements.adminNewTagInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addAdminTag();
    }
  });
  elements.adminTagChips?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-tag-remove]");
    if (!button) {
      return;
    }

    await removeAdminTag(button.dataset.tagRemove);
  });

  elements.libraryGrid.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const { action, id } = button.dataset;
    if (action === "remove") {
      await removeReference(id);
      return;
    }

    if (action === "toggle-details") {
      toggleReferenceDetails(id);
      return;
    }

    if (action === "preview") {
      await previewReference(id, button);
      return;
    }

    if (action === "rename") {
      await saveReferenceName(id);
      return;
    }
  });

  elements.libraryGrid.addEventListener("change", async (event) => {
    const select = event.target.closest("[data-tag-select]");
    if (select) {
      await retagReference(select.dataset.tagSelect, select.value);
      return;
    }

    const input = event.target.closest("[data-metadata-input]");
    if (input) {
      markMetadataDraft(input.dataset.metadataInput);
    }
  });

  elements.libraryGrid.addEventListener("input", (event) => {
    const input = event.target.closest("[data-metadata-input]");
    if (input) {
      markMetadataDraft(input.dataset.metadataInput);
    }
  });
}

function loadSavedState() {
  try {
    const savedSettingsVersion = Number(localStorage.getItem(STORAGE_KEYS.settingsVersion) || 0);
    const rawSettings = localStorage.getItem(STORAGE_KEYS.settings);
    if (rawSettings) {
      state.settings = { ...state.settings, ...JSON.parse(rawSettings) };
    }
    if (savedSettingsVersion < 3 && state.settings.analysisMode === "fast") {
      state.settings.analysisMode = "field";
      state.settings.captureSeconds = Math.max(state.settings.captureSeconds, 8);
      persistSettings();
    }
    if (savedSettingsVersion < 4 && state.settings.analysisMode === "field") {
      state.settings.captureSeconds = Math.max(state.settings.captureSeconds, 10);
      state.settings.minimumConfidence = Math.min(state.settings.minimumConfidence, 45);
      persistSettings();
    }
    localStorage.setItem(STORAGE_KEYS.settingsVersion, String(SETTINGS_SCHEMA_VERSION));

    const rawHistory = localStorage.getItem(STORAGE_KEYS.history);
    if (rawHistory) {
      state.history = JSON.parse(rawHistory);
    }

    const rawMode = localStorage.getItem(STORAGE_KEYS.mode);
    if (rawMode === "admin" || rawMode === "user") {
      state.uiMode = rawMode;
    }
  } catch (error) {
    console.warn("No se pudo recuperar el estado guardado", error);
  }
}

async function ensureDatabase() {
  if (state.database) {
    return state.database;
  }

  if (!("indexedDB" in window)) {
    return null;
  }

  state.database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DB_STORE_REFERENCES)) {
        database.createObjectStore(DB_STORE_REFERENCES, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(DB_STORE_METADATA)) {
        database.createObjectStore(DB_STORE_METADATA, { keyPath: "storageKey" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    console.warn("No se pudo abrir IndexedDB", error);
    return null;
  });

  return state.database;
}

async function loadPersistedReferences() {
  const database = await ensureDatabase();
  if (!database) {
    return;
  }

  const entries = await new Promise((resolve, reject) => {
    const transaction = database.transaction(DB_STORE_REFERENCES, "readonly");
    const store = transaction.objectStore(DB_STORE_REFERENCES);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    console.warn("No se pudieron recuperar las referencias persistidas", error);
    return [];
  });

  for (const entry of entries) {
    if (!(entry.blob instanceof Blob)) {
      continue;
    }

    try {
      const reference = await addReferenceFromArrayBuffer(await entry.blob.arrayBuffer(), {
        id: entry.id,
        origin: "local-upload",
        storageKey: entry.storageKey || `local-upload:${entry.filename}`,
        name: entry.name,
        source: entry.source || "Carga persistida",
        filename: entry.filename,
        fileSize: entry.fileSize,
        mimeType: entry.mimeType,
        lastModified: entry.lastModified,
        previewUrl: URL.createObjectURL(entry.blob),
        previewType: "object-url",
        tag: entry.tag || DEFAULT_TAG,
        notes: entry.notes || "",
        isPersistent: true,
      });

      reference.persistedBlob = entry.blob;
    } catch (error) {
      console.warn(`No se pudo restaurar ${entry.filename}`, error);
    }
  }

  refreshDistinctiveReferenceSegments();
}

async function savePersistentReference(reference, blob) {
  if (!reference?.isPersistent || !(blob instanceof Blob)) {
    return;
  }

  const database = await ensureDatabase();
  if (!database) {
    return;
  }

  const payload = {
    id: reference.id,
    storageKey: reference.storageKey,
    name: reference.name,
    tag: reference.tag || DEFAULT_TAG,
    notes: reference.notes || "",
    source: reference.source,
    filename: reference.filename,
    fileSize: reference.fileSize || blob.size,
    mimeType: reference.mimeType || blob.type || "audio/mpeg",
    lastModified: reference.lastModified || null,
    blob,
  };

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(DB_STORE_REFERENCES, "readwrite");
    const store = transaction.objectStore(DB_STORE_REFERENCES);
    const request = store.put(payload);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    console.warn(`No se pudo guardar ${reference.filename} en IndexedDB`, error);
  });

  reference.persistedBlob = blob;
}

async function syncPersistentReference(reference) {
  if (!reference) {
    return;
  }

  if (reference.isPersistent && reference.persistedBlob instanceof Blob) {
    await savePersistentReference(reference, reference.persistedBlob);
    return;
  }

  if (reference.origin === "manifest") {
    if (state.adminAuthenticated && canUseAdminApi()) {
      const saved = await saveGlobalMetadataFile();
      if (saved) {
        return;
      }
    } else if (isStaticPublicDemo()) {
      showAdminMetadataStatus(
        "Vista publica: los cambios se guardan solo en este navegador.",
        false,
      );
    }
    await saveReferenceMetadata(reference);
  }
}

async function loadReferenceMetadataMap() {
  const database = await ensureDatabase();
  if (!database || !database.objectStoreNames.contains(DB_STORE_METADATA)) {
    return new Map();
  }

  const entries = await new Promise((resolve, reject) => {
    const transaction = database.transaction(DB_STORE_METADATA, "readonly");
    const store = transaction.objectStore(DB_STORE_METADATA);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    console.warn("No se pudieron recuperar metadatos de referencias", error);
    return [];
  });

  return new Map(entries.map((entry) => [entry.storageKey, entry]));
}

async function saveReferenceMetadata(reference) {
  const database = await ensureDatabase();
  if (!database || !database.objectStoreNames.contains(DB_STORE_METADATA)) {
    return;
  }

  const payload = {
    storageKey: reference.storageKey,
    name: reference.name,
    tag: reference.tag || DEFAULT_TAG,
    notes: reference.notes || "",
    updatedAt: Date.now(),
  };

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(DB_STORE_METADATA, "readwrite");
    const store = transaction.objectStore(DB_STORE_METADATA);
    const request = store.put(payload);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    console.warn(`No se pudieron guardar metadatos de ${reference.filename}`, error);
  });
}

async function saveGlobalMetadataFile() {
  if (!state.adminAuthenticated || !canUseAdminApi()) {
    return false;
  }

  const payload = buildGlobalMetadataPayload();
  try {
    const response = await fetch("./api/admin/metadata", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    if (result.metadata?.tags) {
      state.availableTags = normalizeTagList(result.metadata.tags);
    }
    return true;
  } catch (error) {
    console.warn("No se pudieron guardar metadatos globales", error);
    showAdminMetadataStatus("No se pudo guardar en metadata.json. Se mantiene copia local.", true);
    return false;
  }
}

function buildGlobalMetadataPayload() {
  const references = {};
  state.references
    .filter((reference) => reference.origin === "manifest")
    .forEach((reference) => {
      references[reference.filename] = {
        name: reference.name,
        tag: reference.tag || DEFAULT_TAG,
        notes: reference.notes || "",
        updatedAt: Date.now(),
      };
    });

  return {
    tags: normalizeTagList(state.availableTags),
    references,
  };
}

function normalizeTagList(tags) {
  const normalized = [];
  [DEFAULT_TAG, ...(Array.isArray(tags) ? tags : [])].forEach((tag) => {
    const cleanTag = String(tag || "").trim();
    if (cleanTag && !normalized.includes(cleanTag)) {
      normalized.push(cleanTag);
    }
  });
  return normalized;
}

function normalizeTextForSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function getTagVisualClass(tag) {
  const normalized = normalizeTextForSearch(tag || DEFAULT_TAG);
  const knownTags = [
    ["sin etiqueta", "tag-neutral"],
    ["oracion", "tag-prayer"],
    ["llamada", "tag-call"],
    ["procesion", "tag-procession"],
    ["recogida", "tag-return"],
    ["marcha lenta", "tag-slow"],
    ["exhibicion", "tag-show"],
  ];

  const match = knownTags.find(([name]) => normalized.includes(name));
  if (match) {
    return match[1];
  }

  let hash = 0;
  [...normalized].forEach((char) => {
    hash = (hash + char.charCodeAt(0)) % 5;
  });
  return `tag-custom-${hash + 1}`;
}

async function loadDetectionCalibration() {
  if (isFileProtocol()) {
    return;
  }

  try {
    const response = await fetch("./assets/pasos/calibration.json", {
      cache: "no-store",
    });
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    state.detectionLimits = sanitizeDetectionLimits(payload?.recommendedLimits || {});
    console.info("Calibracion de deteccion cargada", state.detectionLimits);
  } catch (error) {
    console.warn("No se pudo cargar calibration.json; se usan umbrales por defecto", error);
  }
}

function sanitizeDetectionLimits(limits) {
  return Object.fromEntries(
    Object.entries(DEFAULT_DETECTION_LIMITS).map(([key, defaultValue]) => {
      const value = Number(limits[key]);
      if (!Number.isFinite(value)) {
        return [key, defaultValue];
      }
      return [key, clamp(value, 0, Number.MAX_SAFE_INTEGER)];
    }),
  );
}

function detectionLimit(key, modeKey = state.settings.analysisMode) {
  const baseValue = state.detectionLimits?.[key] ?? DEFAULT_DETECTION_LIMITS[key];
  return MODE_LIMIT_OVERRIDES[modeKey]?.[key] ?? baseValue;
}

function getReferenceInitials(reference) {
  const source = reference.tag && reference.tag !== DEFAULT_TAG ? reference.tag : reference.name;
  const words = String(source || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return "T";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function mergeAvailableTags(tags) {
  state.availableTags = normalizeTagList([...state.availableTags, ...(Array.isArray(tags) ? tags : [])]);
}

async function deletePersistentReference(referenceId) {
  const database = await ensureDatabase();
  if (!database) {
    return;
  }

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(DB_STORE_REFERENCES, "readwrite");
    const store = transaction.objectStore(DB_STORE_REFERENCES);
    const request = store.delete(referenceId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    console.warn(`No se pudo eliminar la referencia persistida ${referenceId}`, error);
  });
}

async function clearPersistentReferences() {
  const database = await ensureDatabase();
  if (!database) {
    return;
  }

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(DB_STORE_REFERENCES, "readwrite");
    const store = transaction.objectStore(DB_STORE_REFERENCES);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    console.warn("No se pudo vaciar IndexedDB", error);
  });
}

function persistSettings() {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
}

function persistHistory() {
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(state.history));
}

function persistMode() {
  localStorage.setItem(STORAGE_KEYS.mode, state.uiMode);
}

function syncSettingsUi() {
  const mode = MODE_PRESETS[state.settings.analysisMode] || MODE_PRESETS.fast;
  elements.captureDuration.value = String(state.settings.captureSeconds);
  elements.captureDurationValue.textContent = `${state.settings.captureSeconds} s`;
  elements.minimumConfidence.value = String(state.settings.minimumConfidence);
  elements.minimumConfidenceValue.textContent = `${state.settings.minimumConfidence}%`;
  elements.analysisMode.value = state.settings.analysisMode;
  elements.modeLabel.textContent = mode.label;
  elements.listenHint.textContent = `${state.settings.captureSeconds} segundos`;
  renderTagFilterOptions();
}

function syncModeUi() {
  document.body.classList.remove("mode-user", "mode-admin");
  document.body.classList.add(state.uiMode === "admin" ? "mode-admin" : "mode-user");
  elements.modeStatusBadge.textContent =
    state.uiMode === "admin" ? "Modo administración" : "Modo usuario";
  elements.modeToggleButton.textContent =
    state.uiMode === "admin" ? "Salir" : "Admin";
  if (state.uiMode === "admin") {
    setAdminActivePanel(state.adminActivePanel || "admin-panel");
    updateBottomNavState(state.adminActivePanel);
  } else {
    stopReferencePreviews();
    updateBottomNavState("detect");
  }
}

function renderAll() {
  renderLibrary();
  renderHistory();
  renderMatches(state.lastResult?.matches ?? []);
  refreshHeaderStats();
}

function refreshHeaderStats() {
  elements.referenceCount.textContent = String(state.references.length);
  elements.historyCount.textContent = String(state.history.length);
  if (state.diagnostics.commonEntries) {
    elements.librarySummary.textContent =
      `${state.references.length} referencias activas · base común ${state.diagnostics.commonLoaded}/${state.diagnostics.commonEntries}`;
    if (elements.adminCommonStatus) {
      elements.adminCommonStatus.textContent =
        `${state.diagnostics.commonLoaded}/${state.diagnostics.commonEntries}`;
    }
  } else {
    elements.librarySummary.textContent = `${state.references.length} referencias activas`;
    if (elements.adminCommonStatus) {
      elements.adminCommonStatus.textContent = "0/0";
    }
  }
  elements.adminTotalAudios.textContent = String(state.references.length);
  elements.adminFilteredAudios.textContent = String(getFilteredReferences().length);
}

async function toggleMode() {
  if (state.uiMode === "admin") {
    stopReferencePreviews();
    await logoutAdminSession();
    state.uiMode = "user";
    persistMode();
    syncModeUi();
    return;
  }

  if (!canUseAdminApi()) {
    if (isStaticPublicDemo()) {
      enterStaticAdminDemo();
      return;
    }

    showToast(
      "Abre con servidor",
      "El modo administrador necesita el servidor local o la demo publica de GitHub Pages.",
      "warning",
    );
    return;
  }

  openAdminLoginModal();
}

function openAdminLoginModal() {
  if (!elements.adminLoginModal) {
    return;
  }

  elements.adminLoginError.hidden = true;
  elements.adminPasswordInput.value = "";
  elements.adminLoginSubmitButton.disabled = false;
  elements.adminLoginSubmitButton.textContent = "Entrar";
  elements.adminLoginModal.hidden = false;
  window.setTimeout(() => elements.adminPasswordInput?.focus(), 40);
}

function closeAdminLoginModal() {
  if (!elements.adminLoginModal) {
    return;
  }

  elements.adminLoginModal.hidden = true;
  elements.adminPasswordInput.value = "";
  elements.adminLoginError.hidden = true;
}

async function handleAdminLoginSubmit(event) {
  event.preventDefault();
  const password = elements.adminPasswordInput.value;
  if (!password) {
    elements.adminLoginError.textContent = "Introduce la contraseña.";
    elements.adminLoginError.hidden = false;
    return;
  }

  elements.adminLoginSubmitButton.disabled = true;
  elements.adminLoginSubmitButton.textContent = "Comprobando";
  const authenticated = await loginAdminSession(password);
  elements.adminLoginSubmitButton.disabled = false;
  elements.adminLoginSubmitButton.textContent = "Entrar";

  if (!authenticated) {
    elements.adminLoginError.textContent = "Contraseña incorrecta.";
    elements.adminLoginError.hidden = false;
    elements.adminPasswordInput.select();
    return;
  }

  state.uiMode = "admin";
  state.adminAuthenticated = true;
  persistMode();
  syncModeUi();
  closeAdminLoginModal();
}

function canUseAdminApi() {
  return (
    !isFileProtocol() &&
    !isStaticPublicDemo() &&
    ["http:", "https:"].includes(window.location.protocol)
  );
}

function isStaticPublicDemo() {
  return window.location.hostname.endsWith(GITHUB_PAGES_HOST_SUFFIX);
}

function enterStaticAdminDemo() {
  state.uiMode = "admin";
  state.adminAuthenticated = false;
  persistMode();
  syncModeUi();
  showToast(
    "Administracion visible",
    "En GitHub Pages puedes ver esta seccion, pero los cambios globales no se guardan en el proyecto.",
    "warning",
  );
  showAdminMetadataStatus("Vista publica: edicion solo local en este navegador.");
}

async function refreshAdminSession() {
  if (!canUseAdminApi()) {
    state.adminAuthenticated = false;
    if (state.uiMode === "admin" && !isStaticPublicDemo()) {
      state.uiMode = "user";
      persistMode();
    }
    return;
  }

  try {
    const response = await fetch("./api/admin/status", {
      cache: "no-store",
      credentials: "same-origin",
    });
    const payload = response.ok ? await response.json() : { authenticated: false };
    state.adminAuthenticated = Boolean(payload.authenticated);
    if (state.uiMode === "admin" && !state.adminAuthenticated) {
      state.uiMode = "user";
      persistMode();
    }
  } catch (error) {
    state.adminAuthenticated = false;
    if (state.uiMode === "admin") {
      state.uiMode = "user";
      persistMode();
    }
  }
}

async function loginAdminSession(password) {
  try {
    const response = await fetch("./api/admin/login", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });
    const payload = response.ok ? await response.json() : { authenticated: false };
    return Boolean(payload.authenticated);
  } catch (error) {
    showToast(
      "Servidor no disponible",
      "No se pudo validar la contraseña. Comprueba que la app está abierta con el servidor del proyecto.",
      "error",
    );
    return false;
  }
}

async function logoutAdminSession() {
  state.adminAuthenticated = false;
  if (!canUseAdminApi()) {
    return;
  }

  try {
    await fetch("./api/admin/logout", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch (error) {
    console.warn("No se pudo cerrar la sesión de administración", error);
  }
}

async function toggleListening() {
  if (state.isListening) {
    await stopListening({ manual: true });
    return;
  }

  if (!canRequestMicrophone()) {
    updateStatus("idle", "Micrófono bloqueado");
    updateResult({
      name: "Micrófono no disponible en este contexto",
      meta: getMicrophoneContextMessage(),
      confidence: 0,
      matches: [],
      analysis: null,
    });
    flashSection(elements.resultSection);
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    updateStatus("idle", "Navegador no compatible");
    updateResult({
      name: "Micrófono no compatible",
      meta: "Este navegador no soporta captura de audio moderna. Usa Chrome o Safari móvil actual.",
      confidence: 0,
      matches: [],
      analysis: null,
    });
    return;
  }

  if (!state.references.length) {
    updateStatus("idle", "Sin referencias");
    updateResult({
      name: "Sin biblioteca cargada",
      meta: "Añade primero tus mp3 de referencia para poder detectar toques.",
      confidence: 0,
      matches: [],
      analysis: null,
    });
    flashSection(elements.resultSection);
    return;
  }

  try {
    await startListening();
  } catch (error) {
    console.error(error);
    updateStatus("idle", "Micrófono no disponible");
    updateResult({
      name: "No se pudo acceder al micrófono",
      meta: describeMicrophoneError(error),
      confidence: 0,
      matches: [],
      analysis: null,
    });
    flashSection(elements.resultSection);
  }
}

function canRequestMicrophone() {
  return Boolean(navigator.mediaDevices?.getUserMedia) && (window.isSecureContext || isDevelopmentHost());
}

async function refreshMicrophoneStatus() {
  if (elements.transportStatusLabel) {
    elements.transportStatusLabel.textContent = getTransportStatusLabel();
  }

  if (!elements.micStatusLabel) {
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    elements.micStatusLabel.textContent = "No compatible";
    return;
  }

  if (!window.isSecureContext && !isDevelopmentHost()) {
    elements.micStatusLabel.textContent = "Bloqueado";
    return;
  }

  if (!navigator.permissions?.query) {
    elements.micStatusLabel.textContent = "Listo";
    return;
  }

  try {
    const status = await navigator.permissions.query({ name: "microphone" });
    elements.micStatusLabel.textContent = permissionStateToLabel(status.state);
  } catch (error) {
    elements.micStatusLabel.textContent = "Listo";
  }
}

function setupMicrophonePermissionWatcher() {
  if (!navigator.permissions?.query) {
    return;
  }

  navigator.permissions
    .query({ name: "microphone" })
    .then((status) => {
      status.onchange = () => {
        refreshMicrophoneStatus();
      };
    })
    .catch(() => {});
}

function permissionStateToLabel(state) {
  if (state === "granted") {
    return "Concedido";
  }

  if (state === "denied") {
    return "Denegado";
  }

  return "Pendiente";
}

function getTransportStatusLabel() {
  if (isFileProtocol()) {
    return "Archivo local";
  }

  if (window.location.protocol === "https:") {
    return "HTTPS";
  }

  if (isDevelopmentHost()) {
    return "Localhost";
  }

  return "HTTP red";
}

function getMicrophoneContextMessage() {
  if (!window.isSecureContext && !isDevelopmentHost()) {
    return "El micrófono del navegador solo funciona en un contexto seguro. En este proyecto eso significa abrir la app en localhost en el mismo equipo o servirla por HTTPS. Si entras desde el móvil usando http://IP:8000, muchos navegadores bloquean la grabación.";
  }

  return "El navegador no permite solicitar el micrófono en este contexto.";
}

function describeMicrophoneError(error) {
  if (error?.name === "NotAllowedError") {
    return "El navegador ha bloqueado el permiso del micrófono. Revisa los permisos del sitio y vuelve a pulsar Escuchar.";
  }

  if (error?.name === "NotFoundError") {
    return "No se ha encontrado ningún micrófono disponible en este dispositivo.";
  }

  if (error?.name === "SecurityError") {
    return getMicrophoneContextMessage();
  }

  return "Revisa permisos del navegador o abre la app desde un servidor local seguro.";
}

async function ensureAudioContext() {
  if (!state.audioContext) {
    const Context = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new Context();
  }

  if (state.audioContext.state === "suspended") {
    await state.audioContext.resume();
  }
}

async function startListening() {
  await ensureAudioContext();
  state.recordingChunks = [];

  state.mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });

  state.mediaSource = state.audioContext.createMediaStreamSource(state.mediaStream);
  state.analyser = state.audioContext.createAnalyser();
  state.analyser.fftSize = 1024;
  state.processor = await createCaptureProcessor();

  state.mediaSource.connect(state.analyser);
  state.analyser.connect(state.processor);
  state.processor.connect(state.audioContext.destination);

  state.isListening = true;
  state.captureStartedAt = Date.now();
  elements.listenButton.classList.add("is-listening");
  elements.listenButton.setAttribute("aria-label", "Parar escucha");
  elements.listenLabel.textContent = "Parar";
  elements.listenHint.textContent = "Ver resultado";
  updateStatus("listening", "Escuchando");
  updateResult({
    name: "Analizando ambiente",
    meta: `Escuchando durante ${state.settings.captureSeconds} segundos para identificar el toque.`,
    confidence: 0,
    matches: [],
    analysis: null,
  });

  state.stopTimer = window.setTimeout(
    () => stopListening({ manual: false }),
    state.settings.captureSeconds * 1000,
  );
}

async function createCaptureProcessor() {
  if (state.audioContext.audioWorklet) {
    try {
      await state.audioContext.audioWorklet.addModule(AUDIO_WORKLET_MODULE);
      const workletNode = new AudioWorkletNode(state.audioContext, "cofrabeat-recorder", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });

      workletNode.port.onmessage = (event) => {
        const input = event.data?.audio;
        if (!input?.length) {
          return;
        }

        const chunk = input instanceof Float32Array ? input : new Float32Array(input);
        state.recordingChunks.push(chunk);
        updateMeter(chunk);
      };

      return workletNode;
    } catch (error) {
      console.warn("AudioWorklet no disponible, usando captura compatible", error);
    }
  }

  const scriptProcessor = state.audioContext.createScriptProcessor(4096, 1, 1);
  scriptProcessor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    state.recordingChunks.push(new Float32Array(input));
    updateMeter(input);
  };

  return scriptProcessor;
}

async function stopListening({ manual = false } = {}) {
  if (!state.isListening) {
    return;
  }

  window.clearTimeout(state.stopTimer);
  state.stopTimer = null;
  state.isListening = false;
  const capturedSeconds = getCapturedSeconds();

  elements.listenButton.classList.remove("is-listening");
  elements.listenButton.setAttribute("aria-label", "Escuchar");
  elements.listenLabel.textContent = "Procesando";
  elements.listenHint.textContent = "Comparando";
  updateStatus("ready", manual ? "Parado, procesando" : "Procesando");
  updateResult({
    name: manual ? "Escucha detenida" : "Escucha completada",
    meta: `Procesando ${capturedSeconds.toFixed(1)} segundos de audio captado.`,
    confidence: 0,
    matches: [],
    analysis: null,
  });
  showResultSection();

  const inputSignal = flattenChunks(state.recordingChunks);
  releaseMicrophoneCapture();
  cleanupListeningNodes();

  try {
    processCapturedSignal(inputSignal, capturedSeconds);
  } catch (error) {
    console.error("No se pudo procesar la captura", error);
    updateResult({
      name: "Error al analizar",
      meta: "La escucha se ha cerrado correctamente, pero el audio captado no se pudo analizar. Vuelve a intentarlo.",
      confidence: 0,
      matches: [],
      analysis: null,
    });
    updateStatus("idle", "Error de análisis");
    resetIdleUi();
  }
}

function releaseMicrophoneCapture() {
  if (state.processor?.port) {
    state.processor.port.onmessage = null;
  }
  state.processor?.disconnect();
  state.analyser?.disconnect();
  state.mediaSource?.disconnect();
  state.mediaStream?.getTracks().forEach((track) => track.stop());
}

function processCapturedSignal(inputSignal, capturedSeconds) {
  if (inputSignal.length < ANALYSIS_WINDOW) {
    updateResult({
      name: "Audio insuficiente",
      meta: `Se captaron solo ${capturedSeconds.toFixed(1)} segundos útiles. Vuelve a probar dejando sonar el toque algo más de tiempo y acercando el móvil o el micrófono al tambor.`,
      confidence: 0,
      matches: [],
      analysis: null,
    });
    resetIdleUi();
    return;
  }

  const preparedCapture = prepareCaptureSignalForAnalysis(inputSignal);
  const candidate = analyseCaptureCandidates(
    preparedCapture.signal,
    state.audioContext.sampleRate,
    state.references,
    state.settings.analysisMode,
  );
  const features = candidate.features;
  features.capturePreprocess = preparedCapture.metrics;

  if (!candidate.usable) {
    updateResult({
      name: "Sin toque detectable",
      meta: buildCaptureAdvice(features),
      confidence: 0,
      matches: [],
      analysis: features,
    });
    updateStatus("idle", "Sin toque");
    resetIdleUi();
    return;
  }

  const results = candidate.results;
  const bestMatch = results[0];

  if (!bestMatch) {
    updateResult({
      name: "Sin coincidencia",
      meta: "No había referencias suficientes para comparar este audio.",
      confidence: 0,
      matches: [],
      analysis: features,
    });
    updateStatus("idle", "Sin coincidencia");
    resetIdleUi();
    return;
  }

  const ambiguity = getMatchAmbiguity(results);
  const reliableMatch = isReliableMatch(bestMatch, state.settings);
  const probableFieldMatch = state.settings.analysisMode === "field" && isProbableFieldMatch(bestMatch);
  if (!reliableMatch || ambiguity) {
    const ambiguityMeta = ambiguity
      ? probableFieldMatch
        ? `Posible toque: "${bestMatch.reference.name}" (${getVisibleConfidence(bestMatch)}%). También se parece a "${ambiguity.reference.name}". ${formatCaptureDiagnostics(features)} ${formatWindowDiagnostics(candidate)} No está confirmado; repite la escucha más cerca del altavoz o del tambor para asegurar el resultado.`
        : `Resultado parecido entre "${bestMatch.reference.name}" y "${ambiguity.reference.name}". ${formatCaptureDiagnostics(features)} ${formatWindowDiagnostics(candidate)} Repite la escucha más cerca del altavoz o del tambor para confirmar.`
      : probableFieldMatch
        ? `Posible toque: "${bestMatch.reference.name}" (${getVisibleConfidence(bestMatch)}%). ${formatCaptureDiagnostics(features)} ${formatWindowDiagnostics(candidate)} La coincidencia parece buena, pero aún no está confirmada.`
        : `Resultado no concluyente tras ${capturedSeconds.toFixed(1)} s de escucha. ${buildCaptureAdvice(features)}`;
    updateResult({
      name: ambiguity
        ? probableFieldMatch
          ? `Posible toque ambiguo: ${bestMatch.reference.name}`
          : "Resultado ambiguo"
        : probableFieldMatch
          ? `Posible toque: ${bestMatch.reference.name}`
          : "Sin detección fiable",
      meta: ambiguityMeta,
      confidence: probableFieldMatch ? getVisibleConfidence(bestMatch) : 0,
      matches: results,
      analysis: features,
    });
    updateStatus(
      probableFieldMatch ? "probable" : ambiguity ? "ambiguous" : "idle",
      probableFieldMatch ? "Probable" : ambiguity ? "Ambiguo" : "No concluyente",
    );
    resetIdleUi();
    return;
  }

  updateResult({
    name: bestMatch.reference.name,
    meta: `${formatMatchMeta(bestMatch, features)}${formatWindowDiagnostics(candidate)}`,
    confidence: getVisibleConfidence(bestMatch),
    matches: results,
    analysis: features,
  });
  updateStatus("match", "Detección completada");
  pushHistory(bestMatch, features, false);
  resetIdleUi();
}

function getCapturedSeconds() {
  if (!state.captureStartedAt) {
    return 0;
  }

  return Math.max(0, (Date.now() - state.captureStartedAt) / 1000);
}

function showResultSection() {
  updateBottomNavState("result");
  scrollToSection(elements.resultSection);
  flashSection(elements.resultSection);
}

function cleanupListeningNodes() {
  state.processor = null;
  state.analyser = null;
  state.mediaSource = null;
  state.mediaStream = null;
}

function resetIdleUi() {
  state.captureStartedAt = null;
  elements.listenButton.setAttribute("aria-label", "Escuchar");
  elements.listenLabel.textContent = "Escuchar";
  elements.listenHint.textContent = `${state.settings.captureSeconds} segundos`;
  elements.meterFill.style.width = "6%";
}

function updateMeter(samples) {
  let energy = 0;
  for (let index = 0; index < samples.length; index += 1) {
    energy += samples[index] * samples[index];
  }

  const rms = Math.sqrt(energy / samples.length);
  const percentage = Math.min(100, Math.max(6, rms * 380));
  elements.meterFill.style.width = `${percentage}%`;
}

async function loadManifestReferences() {
  if (isFileProtocol()) {
    setAppLoadingState(true, {
      title: "Modo local detectado",
      meta: "Se omite la base común porque la app está abierta con file://.",
      progress: 80,
    });
    return;
  }

  try {
    const response = await fetch("./assets/pasos/manifest.json");
    if (!response.ok) {
      return;
    }

    const metadataByKey = await loadReferenceMetadataMap();
    const manifest = await response.json();
    const entries = Array.isArray(manifest.references) ? manifest.references : [];
    mergeAvailableTags(manifest.tags);
    const precomputedFeatures = await loadPrecomputedFeatureMap();
    state.diagnostics.commonEntries = entries.length;
    state.diagnostics.commonLoaded = 0;
    state.diagnostics.commonFailed = 0;
    updateBootManifestProgress(0, entries.length, "Leyendo manifest de la base común.");
    if (elements.adminCommonMessage) {
      elements.adminCommonMessage.hidden = false;
      elements.adminCommonMessage.textContent = `Manifest leído: ${entries.length} referencias comunes detectadas.`;
    }
    let loadedCount = 0;

    for (const entry of entries) {
      if (!entry.file) {
        continue;
      }

      const assetUrl = buildAssetUrl(entry.file);
      const featureEntry = precomputedFeatures.get(entry.file);
      const storageKey = `manifest:${entry.file}`;
      const savedMetadata = metadataByKey.get(storageKey);
      upsertReferenceSkeleton({
        id: `manifest:${entry.file}`,
        origin: "manifest",
        storageKey,
        name: entry.name || savedMetadata?.name || prettifyFileName(entry.file),
        source: "Base común",
        filename: entry.file,
        fileSize: entry.size || 0,
        mimeType: entry.mimeType || "audio/mpeg",
        lastModified: entry.modifiedAt || null,
        previewUrl: assetUrl,
        previewType: "remote",
        isPersistent: false,
        tag: entry.tag || savedMetadata?.tag || DEFAULT_TAG,
        notes: entry.notes || savedMetadata?.notes || "",
        duration: featureEntry?.duration || entry.duration || featureEntry?.features?.durationSeconds || 0,
        sampleRate: featureEntry?.sampleRate || entry.sampleRate || 0,
        channels: featureEntry?.channels || entry.channels || 0,
        features: featureEntry?.features || null,
        analysisStatus: featureEntry?.features ? "ready" : "pending",
      });
      if (featureEntry?.features) {
        loadedCount += 1;
        updateBootManifestProgress(loadedCount, entries.length, "Aplicando referencias precomputadas.");
      }
    }

    state.diagnostics.commonLoaded = loadedCount;
    refreshDistinctiveReferenceSegments();
    renderAll();

    await Promise.allSettled(
      entries
        .filter((entry) => entry.file && !precomputedFeatures.has(entry.file))
        .map(async (entry) => {
          try {
            const assetUrl = buildAssetUrl(entry.file);
            const responseFile = await fetch(assetUrl);
            if (!responseFile.ok) {
              throw new Error(`HTTP ${responseFile.status}`);
            }

            const blob = await responseFile.blob();
            const arrayBuffer = await blob.arrayBuffer();
            await addReferenceFromArrayBuffer(arrayBuffer, {
              id: `manifest:${entry.file}`,
              origin: "manifest",
              storageKey: `manifest:${entry.file}`,
              name:
                entry.name ||
                metadataByKey.get(`manifest:${entry.file}`)?.name ||
                prettifyFileName(entry.file),
              source: "Base común",
              filename: entry.file,
              fileSize: entry.size || blob.size,
              mimeType: entry.mimeType || responseFile.headers.get("content-type") || "audio/mpeg",
              lastModified: entry.modifiedAt || null,
              previewUrl: assetUrl,
              previewType: "remote",
              isPersistent: false,
              tag: entry.tag || metadataByKey.get(`manifest:${entry.file}`)?.tag || DEFAULT_TAG,
              notes: entry.notes || metadataByKey.get(`manifest:${entry.file}`)?.notes || "",
              analysisStatus: "ready",
            });
            loadedCount += 1;
            state.diagnostics.commonLoaded = loadedCount;
            renderLibrary();
            refreshHeaderStats();
            updateBootManifestProgress(loadedCount, entries.length, "Procesando audios de la base común.");
          } catch (error) {
            state.diagnostics.commonFailed += 1;
            markReferenceAnalysisFailed(`manifest:${entry.file}`);
            console.warn(`No se pudo procesar ${entry.file}`, error);
            updateBootManifestProgress(loadedCount + state.diagnostics.commonFailed, entries.length, "Procesando audios de la base común.");
          }
        }),
    );

    if (entries.length && !loadedCount) {
      updateStatus("idle", "Base común no cargada");
      updateResult({
        name: "No se pudo cargar la biblioteca común",
        meta: "El manifest existe, pero ninguno de los audios comunes se pudo abrir o decodificar. Revisa la consola y los nombres de archivo dentro de assets/pasos.",
        confidence: 0,
        matches: [],
        analysis: null,
      });
      if (elements.adminCommonMessage) {
        elements.adminCommonMessage.hidden = false;
        elements.adminCommonMessage.textContent =
          `Manifest leído: ${entries.length}. Cargados: 0. Fallidos: ${state.diagnostics.commonFailed}.`;
      }
    } else if (entries.length) {
      if (elements.adminCommonMessage) {
        elements.adminCommonMessage.hidden = false;
        elements.adminCommonMessage.textContent =
          `Manifest leído: ${entries.length}. Cargados: ${state.diagnostics.commonLoaded}. Fallidos: ${state.diagnostics.commonFailed}.`;
      }
    } else {
      if (elements.adminCommonMessage) {
        elements.adminCommonMessage.hidden = false;
        elements.adminCommonMessage.textContent = "Manifest leído, pero sin referencias comunes.";
      }
    }

    refreshDistinctiveReferenceSegments();
    refreshHeaderStats();
  } catch (error) {
    console.warn("No se pudo cargar el manifest de referencias", error);
    setAppLoadingState(true, {
      title: "Base común no disponible",
      meta: "No se pudo leer el manifest compartido. La app seguirá con las referencias locales disponibles.",
      progress: 78,
    });
    if (elements.adminCommonMessage) {
      elements.adminCommonMessage.hidden = false;
      elements.adminCommonMessage.textContent =
        "No se pudo leer el manifest de la base común. Revisa la consola.";
    }
  }
}

async function loadPrecomputedFeatureMap() {
  const featuresByFile = new Map();

  try {
    const response = await fetch("./assets/pasos/features.json", { cache: "no-store" });
    if (!response.ok) {
      return featuresByFile;
    }

    const payload = await response.json();
    const entries = Array.isArray(payload.references) ? payload.references : [];
    entries.forEach((entry) => {
      if (!entry.file || !entry.features || entry.error || !hasCompatibleFeatureSet(entry.features)) {
        return;
      }

      featuresByFile.set(entry.file, entry);
    });
  } catch (error) {
    console.warn("No se pudieron cargar features precomputadas", error);
  }

  return featuresByFile;
}

function hasCompatibleFeatureSet(features) {
  return Boolean(
    features &&
    features.schemaVersion === FEATURE_SCHEMA_VERSION &&
    Array.isArray(features.spectralLandmarks) &&
    typeof features.spectralLandmarksCount === "number" &&
    Array.isArray(features.strongSegments),
  );
}

async function loadFilesAsReferences(files) {
  if (!files.length) {
    return;
  }

  updateStatus("ready", "Procesando mp3");
  for (const file of files) {
    try {
      const id = crypto.randomUUID();
      const arrayBuffer = await file.arrayBuffer();
      const reference = await addReferenceFromArrayBuffer(arrayBuffer, {
        id,
        origin: "local-upload",
        storageKey: buildLocalUploadStorageKey(file),
        name: prettifyFileName(file.name),
        source: "Carga local",
        filename: file.name,
        fileSize: file.size,
        mimeType: file.type || "audio/mpeg",
        lastModified: file.lastModified || null,
        previewUrl: URL.createObjectURL(file),
        previewType: "object-url",
        isPersistent: true,
      });
      await savePersistentReference(reference, file);
    } catch (error) {
      console.warn(`No se pudo cargar ${file.name}`, error);
    }
  }

  refreshDistinctiveReferenceSegments();
  renderAll();
  updateStatus("ready", "Biblioteca actualizada");
}

function buildLocalUploadStorageKey(file) {
  return `local-upload:${file.name}:${file.size}:${file.lastModified || 0}`;
}

async function addReferenceFromArrayBuffer(arrayBuffer, metadata) {
  await ensureAudioContext();
  const buffer = await decodeAudioBufferWithTimeout(arrayBuffer);
  const mono = mixToMono(buffer);
  const features = analyseSignal(mono, buffer.sampleRate, true);
  const existingIndex = state.references.findIndex(
    (reference) => reference.storageKey === metadata.storageKey,
  );

  const reference = {
    id: metadata.id || (existingIndex >= 0 ? state.references[existingIndex].id : crypto.randomUUID()),
    ...metadata,
    origin:
      metadata.origin || state.references[existingIndex]?.origin || "runtime",
    storageKey:
      metadata.storageKey ||
      state.references[existingIndex]?.storageKey ||
      `${metadata.origin || "runtime"}:${metadata.filename}`,
    tag: metadata.tag || state.references[existingIndex]?.tag || DEFAULT_TAG,
    duration: buffer.duration,
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
    features,
    analysisStatus: metadata.analysisStatus || "ready",
    previewAudio: null,
  };

  if (existingIndex >= 0) {
    revokeReferencePreview(state.references[existingIndex]);
    state.references.splice(existingIndex, 1, reference);
  } else {
    state.references.push(reference);
  }

  return reference;
}

function upsertReferenceSkeleton(metadata) {
  const existingIndex = state.references.findIndex(
    (reference) => reference.storageKey === metadata.storageKey,
  );

  const existing = existingIndex >= 0 ? state.references[existingIndex] : null;
  const reference = {
    id: metadata.id || existing?.id || crypto.randomUUID(),
    ...existing,
    ...metadata,
    tag: metadata.tag || existing?.tag || DEFAULT_TAG,
    duration: metadata.duration || existing?.duration || metadata.features?.durationSeconds || 0,
    sampleRate: metadata.sampleRate || existing?.sampleRate || 0,
    channels: metadata.channels || existing?.channels || 0,
    features: metadata.features || existing?.features || null,
    previewAudio: existing?.previewAudio || null,
  };

  if (existingIndex >= 0) {
    state.references.splice(existingIndex, 1, reference);
  } else {
    state.references.push(reference);
    if (reference.origin === "manifest") {
      state.collapsedReferences.add(reference.id);
    }
  }

  return reference;
}

function markReferenceAnalysisFailed(referenceId) {
  const reference = state.references.find((item) => item.id === referenceId);
  if (!reference) {
    return;
  }

  reference.analysisStatus = "failed";
  renderLibrary();
  refreshHeaderStats();
}

async function decodeAudioBufferWithTimeout(arrayBuffer) {
  return Promise.race([
    state.audioContext.decodeAudioData(arrayBuffer.slice(0)),
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("Tiempo de espera agotado al decodificar audio")), DECODE_TIMEOUT_MS);
    }),
  ]);
}

function mixToMono(audioBuffer) {
  const channels = audioBuffer.numberOfChannels;
  const mono = new Float32Array(audioBuffer.length);

  for (let channel = 0; channel < channels; channel += 1) {
    const data = audioBuffer.getChannelData(channel);
    for (let index = 0; index < data.length; index += 1) {
      mono[index] += data[index] / channels;
    }
  }

  return mono;
}

function flattenChunks(chunks) {
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Float32Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function analyseSignal(signal, sampleRate, includeSegments = false) {
  const rawStats = measureSignal(signal);
  const normalized = normalizeSignal(signal);
  const envelope = buildEnvelope(normalized);
  const onset = buildOnsetProfile(envelope);
  const spectral = buildSpectralSignature(normalized, sampleRate);
  const peakIndexes = detectPeaks(onset);
  const intervalProfile = buildIntervalProfile(peakIndexes, sampleRate);
  const tempoEstimate = estimateTempo(peakIndexes, sampleRate);
  const durationSeconds = signal.length / sampleRate;
  const hopSeconds = (ANALYSIS_WINDOW / 2) / sampleRate;
  const peakTimes = peakIndexes.map((index) => index * hopSeconds);
  const fingerprints = buildRhythmFingerprints(peakTimes);
  const density = peakIndexes.length / Math.max(1, onset.length);
  const peakRate = peakIndexes.length / Math.max(0.1, durationSeconds);
  const onsetStats = measureOnsetProfile(onset, peakIndexes);
  const rhythmicStability = estimateRhythmicStability(peakTimes);

  const features = {
    envelope: resampleVector(envelope, ENVELOPE_BINS),
    onset: resampleVector(onset, ENVELOPE_BINS),
    envelopeSeries: [...envelope],
    onsetSeries: [...onset],
    intervals: intervalProfile,
    density,
    peakRate,
    tempoEstimate,
    peaksCount: peakIndexes.length,
    peakTimes,
    fingerprints,
    fingerprintsCount: fingerprints.length,
    durationSeconds,
    hopSeconds,
    rms: rawStats.rms,
    peakAmplitude: rawStats.peak,
    onsetContrast: onsetStats.contrast,
    onsetPeakMean: onsetStats.peakMean,
    rhythmicStability,
    spectralProfile: spectral.profile,
    spectralFlux: resampleVector(spectral.fluxSeries, ENVELOPE_BINS),
    spectralFluxSeries: [...spectral.fluxSeries],
    spectralLandmarks: spectral.landmarks,
    spectralLandmarksCount: spectral.landmarks.length,
    signalQuality: estimateSignalQuality(
      rawStats,
      peakIndexes.length,
      peakRate,
      onsetStats.contrast,
      rhythmicStability,
    ),
  };

  features.strongSegments = includeSegments ? buildStrongReferenceSegments(signal, sampleRate) : [];
  return features;
}

function buildStrongReferenceSegments(signal, sampleRate) {
  const durationSeconds = signal.length / sampleRate;
  if (durationSeconds < Math.min(...REFERENCE_SEGMENT_SECONDS) + 2) {
    return [];
  }

  const frames = measureReferenceEnergyFrames(signal, sampleRate);
  const centers = findStrongReferenceCenters(frames);
  centers.push(...findDistributedReferenceCenters(durationSeconds));
  centers.push(...findDenseReferenceCenters(durationSeconds));
  const segments = [];
  const seen = new Set();

  centers.forEach((centerSeconds) => {
    REFERENCE_SEGMENT_SECONDS.forEach((windowSeconds) => {
      const startSeconds = clamp(centerSeconds - windowSeconds / 2, 0, Math.max(0, durationSeconds - windowSeconds));
      const key = `${startSeconds.toFixed(1)}:${windowSeconds}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);

      const startSample = Math.floor(startSeconds * sampleRate);
      const endSample = Math.min(signal.length, Math.ceil((startSeconds + windowSeconds) * sampleRate));
      if (endSample - startSample < ANALYSIS_WINDOW) {
        return;
      }

      const features = analyseSignal(signal.slice(startSample, endSample), sampleRate, false);
      if (features.fingerprintsCount < 4 || features.peaksCount < 4) {
        return;
      }

      const score =
        features.signalQuality * 22 +
        features.onsetContrast * 18 +
        Math.min(18, features.fingerprintsCount * 0.18) +
        Math.min(12, features.peaksCount * 0.6) +
        features.rhythmicStability * 10;

      segments.push({
        startSeconds,
        durationSeconds: (endSample - startSample) / sampleRate,
        baseScore: score,
        score,
        features,
      });
    });
  });

  segments.sort((left, right) => right.score - left.score);
  const selected = [];
  segments.forEach((segment) => {
    if (selected.every((item) => Math.abs(item.startSeconds - segment.startSeconds) > 4)) {
      selected.push(segment);
    }
  });

  return selected.slice(0, MAX_REFERENCE_SEGMENTS);
}

function findDenseReferenceCenters(durationSeconds) {
  if (durationSeconds <= Math.min(...REFERENCE_SEGMENT_SECONDS) + 1) {
    return [];
  }

  const centers = [];
  let cursor = Math.min(...REFERENCE_SEGMENT_SECONDS) / 2;
  const limit = Math.max(cursor, durationSeconds - Math.min(...REFERENCE_SEGMENT_SECONDS) / 2);
  while (cursor <= limit) {
    centers.push(Number(cursor.toFixed(3)));
    cursor += REFERENCE_SEGMENT_STRIDE_SECONDS;
  }
  return centers;
}

function measureReferenceEnergyFrames(signal, sampleRate) {
  const frameSize = Math.max(ANALYSIS_WINDOW, Math.round(sampleRate * 0.25));
  const hopSize = Math.max(1, Math.floor(frameSize / 2));
  const frames = [];

  for (let start = 0; start + frameSize <= signal.length; start += hopSize) {
    let energy = 0;
    for (let index = start; index < start + frameSize; index += 1) {
      const value = signal[index];
      energy += value * value;
    }
    frames.push({
      rms: Math.sqrt(energy / frameSize),
      centerSeconds: (start + frameSize / 2) / sampleRate,
    });
  }

  return frames;
}

function findStrongReferenceCenters(frames) {
  const ordered = [...frames].sort((left, right) => right.rms - left.rms);
  const centers = [];
  ordered.forEach((frame) => {
    if (centers.every((center) => Math.abs(center - frame.centerSeconds) > 6)) {
      centers.push(frame.centerSeconds);
    }
  });
  return centers.slice(0, MAX_REFERENCE_SEGMENTS);
}

function findDistributedReferenceCenters(durationSeconds) {
  if (durationSeconds < 40) {
    return [];
  }

  return [0.12, 0.28, 0.45, 0.62, 0.8].map((marker) => durationSeconds * marker);
}

function prepareCaptureSignalForAnalysis(signal) {
  const sourceStats = measureSignal(signal);
  if (!signal.length) {
    return {
      signal,
      metrics: { applied: false, sourceRms: 0, sourcePeak: 0, processedRms: 0, processedPeak: 0 },
    };
  }

  let sum = 0;
  for (let index = 0; index < signal.length; index += 1) {
    sum += signal[index];
  }
  const dcOffset = sum / signal.length;
  const centered = new Float32Array(signal.length);
  const absSamples = [];
  const sampleStep = Math.max(1, Math.floor(signal.length / 2400));

  for (let index = 0; index < signal.length; index += 1) {
    const value = signal[index] - dcOffset;
    centered[index] = value;
    if (index % sampleStep === 0) {
      absSamples.push(Math.abs(value));
    }
  }

  const centeredStats = measureSignal(centered);
  if (
    centeredStats.rms < detectionLimit("minSignalRms") * 0.55 ||
    centeredStats.peak < detectionLimit("minSignalPeak") * 0.55
  ) {
    return {
      signal: centered,
      metrics: {
        applied: Math.abs(dcOffset) > 0.0005,
        dcOffset,
        noiseGateThreshold: 0,
        sourceRms: sourceStats.rms,
        sourcePeak: sourceStats.peak,
        processedRms: centeredStats.rms,
        processedPeak: centeredStats.peak,
      },
    };
  }

  absSamples.sort((left, right) => left - right);
  const noiseFloor = absSamples[Math.floor(absSamples.length * 0.35)] || 0;
  const gateThreshold = Math.max(noiseFloor * 2.2, centeredStats.rms * 0.055, 0.0015);
  const processed = new Float32Array(centered.length);

  for (let index = 0; index < centered.length; index += 1) {
    const value = centered[index];
    const absolute = Math.abs(value);
    if (absolute < gateThreshold) {
      processed[index] = value * 0.22;
    } else if (absolute < gateThreshold * 1.8) {
      const mix = (absolute - gateThreshold) / gateThreshold;
      processed[index] = value * clamp(0.22 + mix * 0.5, 0.22, 0.72);
    } else {
      processed[index] = value;
    }
  }

  const processedStats = measureSignal(processed);
  return {
    signal: processed,
    metrics: {
      applied: true,
      dcOffset,
      noiseGateThreshold: gateThreshold,
      sourceRms: sourceStats.rms,
      sourcePeak: sourceStats.peak,
      processedRms: processedStats.rms,
      processedPeak: processedStats.peak,
    },
  };
}

function analyseCaptureCandidates(signal, sampleRate, references, modeKey) {
  const windows = buildCaptureWindows(signal, sampleRate);
  let bestCandidate = null;
  let fallbackCandidate = null;

  windows.forEach((window, index) => {
    const features = analyseSignal(window.signal, sampleRate);
    const usable = isUsableCapture(features, modeKey);
    const results = usable ? compareAgainstReferences(features, references, modeKey) : [];
    const bestMatch = results[0] || null;
    const ambiguity = bestMatch ? getMatchAmbiguity(results, modeKey) : null;
    const reliable = Boolean(bestMatch && isReliableMatch(bestMatch, { ...state.settings, analysisMode: modeKey }) && !ambiguity);
    const score = scoreCaptureCandidate(features, bestMatch, ambiguity, reliable, index, modeKey);
    const candidate = { ...window, features, usable, results, bestMatch, ambiguity, reliable, score };

    if (!fallbackCandidate || candidate.score > fallbackCandidate.score) {
      fallbackCandidate = candidate;
    }

    if (!usable || !bestMatch) {
      return;
    }

    if (!bestCandidate || isBetterCaptureCandidate(candidate, bestCandidate)) {
      bestCandidate = candidate;
    }
  });

  return bestCandidate || fallbackCandidate || {
    signal,
    startSeconds: 0,
    durationSeconds: signal.length / sampleRate,
    isFullCapture: true,
    features: analyseSignal(signal, sampleRate),
    usable: false,
    results: [],
    bestMatch: null,
    ambiguity: null,
    reliable: false,
    score: 0,
  };
}

function isBetterCaptureCandidate(candidate, current) {
  if (candidate.reliable !== current.reliable) {
    return candidate.reliable;
  }

  return candidate.score > current.score;
}

function buildCaptureWindows(signal, sampleRate) {
  const fullWindow = {
    signal,
    startSeconds: 0,
    durationSeconds: signal.length / sampleRate,
    isFullCapture: true,
  };
  const durationSeconds = fullWindow.durationSeconds;

  if (durationSeconds <= 6.5) {
    return [fullWindow];
  }

  const activeRange = findActiveSignalRange(signal, sampleRate);
  const windows = [fullWindow];
  const addWindow = (startSeconds, windowSeconds) => {
    const duration = Math.min(windowSeconds, durationSeconds);
    if (duration < 3.8) {
      return;
    }

    const start = clamp(startSeconds, 0, Math.max(0, durationSeconds - duration));
    const startSample = Math.floor(start * sampleRate);
    const endSample = Math.min(signal.length, Math.ceil((start + duration) * sampleRate));
    if (endSample - startSample < ANALYSIS_WINDOW) {
      return;
    }

    const duplicate = windows.some(
      (item) => Math.abs(item.startSeconds - start) < 0.18 && Math.abs(item.durationSeconds - duration) < 0.18,
    );
    if (duplicate) {
      return;
    }

    windows.push({
      signal: signal.slice(startSample, endSample),
      startSeconds: start,
      durationSeconds: (endSample - startSample) / sampleRate,
      isFullCapture: false,
    });
  };

  if (activeRange) {
    const activeCenter = (activeRange.startSeconds + activeRange.endSeconds) / 2;
    CAPTURE_WINDOW_SECONDS.forEach((windowSeconds) => {
      addWindow(activeCenter - windowSeconds / 2, windowSeconds);
    });
    addWindow(activeRange.startSeconds - 0.5, Math.min(durationSeconds, activeRange.durationSeconds + 1));
  }

  const frameBest = findStrongestSignalCenters(signal, sampleRate);
  frameBest.forEach((centerSeconds) => {
    addWindow(centerSeconds - 4, 8);
    addWindow(centerSeconds - 3, 6);
  });

  return windows.slice(0, MAX_CAPTURE_CANDIDATES);
}

function findActiveSignalRange(signal, sampleRate) {
  const frames = measureCaptureFrames(signal, sampleRate);
  if (!frames.length) {
    return null;
  }

  const values = frames.map((frame) => frame.rms).sort((left, right) => left - right);
  const median = values[Math.floor(values.length * 0.5)] || 0;
  const p80 = values[Math.floor(values.length * 0.8)] || 0;
  const peak = values[values.length - 1] || 0;
  const threshold = Math.max(0.003, median * 1.8, p80 * 0.55, peak * 0.16);
  const activeIndexes = frames
    .map((frame, index) => (frame.rms >= threshold ? index : -1))
    .filter((index) => index >= 0);

  if (!activeIndexes.length) {
    return null;
  }

  const startFrame = Math.max(0, activeIndexes[0] - 2);
  const endFrame = Math.min(frames.length - 1, activeIndexes[activeIndexes.length - 1] + 2);
  const startSeconds = frames[startFrame].startSeconds;
  const endSeconds = Math.min(signal.length / sampleRate, frames[endFrame].endSeconds);

  return {
    startSeconds,
    endSeconds,
    durationSeconds: Math.max(0, endSeconds - startSeconds),
  };
}

function findStrongestSignalCenters(signal, sampleRate) {
  const frames = measureCaptureFrames(signal, sampleRate);
  const ordered = frames
    .filter((frame) => frame.rms > 0.003)
    .sort((left, right) => right.rms - left.rms);
  const centers = [];

  ordered.forEach((frame) => {
    const center = (frame.startSeconds + frame.endSeconds) / 2;
    if (centers.every((existing) => Math.abs(existing - center) > 2.5)) {
      centers.push(center);
    }
  });

  return centers.slice(0, 3);
}

function measureCaptureFrames(signal, sampleRate) {
  const frameSize = Math.max(ANALYSIS_WINDOW, Math.round(sampleRate * CAPTURE_FRAME_SECONDS));
  const hopSize = Math.max(1, Math.floor(frameSize / 2));
  const frames = [];

  for (let start = 0; start + frameSize <= signal.length; start += hopSize) {
    let energy = 0;
    for (let index = start; index < start + frameSize; index += 1) {
      const value = signal[index];
      energy += value * value;
    }
    frames.push({
      rms: Math.sqrt(energy / frameSize),
      startSeconds: start / sampleRate,
      endSeconds: (start + frameSize) / sampleRate,
    });
  }

  return frames;
}

function scoreCaptureCandidate(features, bestMatch, ambiguity, reliable, order, modeKey = state.settings.analysisMode) {
  const diagnostics = bestMatch?.diagnostics || {};
  const votes = bestMatch?.alignment?.fingerprintVotes || 0;
  const matchScore = bestMatch
    ? modeKey === "field"
      ? bestMatch.confidence * 0.34 +
        bestMatch.evidenceScore * 30 +
        bestMatch.absoluteSimilarity * 13 +
        (diagnostics.patternScore || 0) * 21 +
        (diagnostics.timbreScore || 0) * 19 +
        (diagnostics.rhythmSimilarity || 0) * 8 +
        (diagnostics.envelopeSimilarity || 0) * 8 +
        (diagnostics.spectralSimilarity || 0) * 8 +
        (diagnostics.spectralFluxSimilarity || 0) * 7 +
        (diagnostics.fieldLeadershipBonus || 0) * 18 +
        Math.min(2.2, votes * 0.11)
      : bestMatch.confidence * 0.45 +
        bestMatch.evidenceScore * 35 +
        bestMatch.absoluteSimilarity * 20 +
        Math.min(12, votes * 0.7)
    : 0;
  const qualityScore = modeKey === "field"
    ? features.signalQuality * 18 +
      features.onsetContrast * 12 +
      features.rhythmicStability * 8 +
      Math.min(8, features.peaksCount * 0.35) +
      Math.min(4, features.fingerprintsCount * 0.04)
    : features.signalQuality * 16 +
      features.onsetContrast * 10 +
      Math.min(8, features.peaksCount * 0.35) +
      Math.min(8, features.fingerprintsCount * 0.08);
  const ambiguityPenalty = ambiguity ? 18 : 0;
  const reliabilityBoost = reliable ? 25 : 0;

  return matchScore + qualityScore + reliabilityBoost - ambiguityPenalty - order * 0.3;
}

function measureSignal(signal) {
  let peak = 0;
  let energy = 0;

  for (let index = 0; index < signal.length; index += 1) {
    const value = signal[index];
    const absolute = Math.abs(value);
    if (absolute > peak) {
      peak = absolute;
    }
    energy += value * value;
  }

  return {
    peak,
    rms: signal.length ? Math.sqrt(energy / signal.length) : 0,
  };
}

function measureOnsetProfile(onset, peakIndexes) {
  if (!onset.length) {
    return { contrast: 0, peakMean: 0 };
  }

  const sorted = [...onset].sort((left, right) => left - right);
  const median = sorted[Math.floor(sorted.length * 0.5)] || 0;
  const p90 = sorted[Math.floor(sorted.length * 0.9)] || 0;
  const peakMean = peakIndexes.length
    ? peakIndexes.reduce((sum, index) => sum + (onset[index] || 0), 0) / peakIndexes.length
    : 0;

  return {
    contrast: clamp(Math.max(p90, peakMean) - median, 0, 1),
    peakMean,
  };
}

function estimateRhythmicStability(peakTimes) {
  if (peakTimes.length < 4) {
    return 0;
  }

  const intervals = [];
  for (let index = 1; index < peakTimes.length; index += 1) {
    const interval = peakTimes[index] - peakTimes[index - 1];
    if (interval > 0.06 && interval < 2.4) {
      intervals.push(interval);
    }
  }

  if (intervals.length < 3) {
    return 0;
  }

  intervals.sort((left, right) => left - right);
  const median = intervals[Math.floor(intervals.length / 2)];
  if (!median) {
    return 0;
  }

  const deviations = intervals
    .map((interval) => Math.abs(interval - median))
    .sort((left, right) => left - right);
  const medianDeviation = deviations[Math.floor(deviations.length / 2)] || 0;

  return clamp(1 - medianDeviation / Math.max(0.08, median * 0.9), 0, 1);
}

function estimateSignalQuality(stats, peaksCount, peakRate, onsetContrast, rhythmicStability) {
  const rmsScore = clamp(stats.rms / 0.08, 0, 1);
  const peakScore = clamp(stats.peak / 0.35, 0, 1);
  const rhythmScore = clamp(peaksCount / 8, 0, 1);
  const rateScore = clamp(peakRate / 3, 0, 1);
  const contrastScore = clamp(onsetContrast / 0.28, 0, 1);

  return (
    rmsScore * 0.22 +
    peakScore * 0.18 +
    rhythmScore * 0.18 +
    rateScore * 0.12 +
    contrastScore * 0.18 +
    rhythmicStability * 0.12
  );
}

function buildSpectralSignature(signal, sampleRate) {
  if (signal.length < ANALYSIS_WINDOW) {
    return {
      profile: Array.from({ length: SPECTRAL_BAND_FREQUENCIES.length }, () => 0),
      fluxSeries: Array.from({ length: ENVELOPE_BINS }, () => 0),
      landmarks: [],
    };
  }

  const hop = ANALYSIS_WINDOW / 2;
  const bandFrames = [];
  const fluxValues = [];
  let previousBands = null;

  for (let start = 0; start + ANALYSIS_WINDOW < signal.length; start += hop) {
    const frame = signal.slice(start, start + ANALYSIS_WINDOW);
    const bands = normalizeArray(
      SPECTRAL_BAND_FREQUENCIES.map((frequency) => goertzelMagnitude(frame, sampleRate, frequency)),
    );
    bandFrames.push(bands);
    if (!previousBands) {
      fluxValues.push(0);
    } else {
      let positiveDelta = 0;
      for (let index = 0; index < bands.length; index += 1) {
        positiveDelta += Math.max(0, bands[index] - previousBands[index]);
      }
      fluxValues.push(positiveDelta / Math.max(1, bands.length));
    }
    previousBands = bands;
  }

  if (!bandFrames.length) {
    return {
      profile: Array.from({ length: SPECTRAL_BAND_FREQUENCIES.length }, () => 0),
      fluxSeries: Array.from({ length: ENVELOPE_BINS }, () => 0),
      landmarks: [],
    };
  }

  const profile = [];
  for (let bandIndex = 0; bandIndex < SPECTRAL_BAND_FREQUENCIES.length; bandIndex += 1) {
    let sum = 0;
    bandFrames.forEach((frame) => {
      sum += frame[bandIndex] || 0;
    });
    profile.push(sum / bandFrames.length);
  }

  return {
    profile: normalizeArray(profile),
    fluxSeries: smoothVector(normalizeArray(fluxValues), 2),
    landmarks: buildSpectralLandmarks(bandFrames, hop / sampleRate),
  };
}

function buildSpectralLandmarks(bandFrames, hopSeconds) {
  if (!bandFrames?.length) {
    return [];
  }

  const framePeaks = bandFrames.map((frame) => extractSpectralPeakBands(frame));
  const landmarks = [];

  framePeaks.forEach((anchorBands, anchorFrame) => {
    if (!anchorBands.length) {
      return;
    }

    anchorBands.forEach((anchorBand) => {
      let neighborCount = 0;
      const maxTargetFrame = Math.min(framePeaks.length - 1, anchorFrame + SPECTRAL_LANDMARK_LOOKAHEAD_FRAMES);
      for (let targetFrame = anchorFrame + 1; targetFrame <= maxTargetFrame; targetFrame += 1) {
        const targetBands = framePeaks[targetFrame];
        if (!targetBands.length) {
          continue;
        }

        const deltaFrames = targetFrame - anchorFrame;
        for (const targetBand of targetBands) {
          landmarks.push({
            hash: `${anchorBand}:${targetBand}:${deltaFrames}`,
            time: Number((anchorFrame * hopSeconds).toFixed(3)),
          });
          neighborCount += 1;
          if (neighborCount >= SPECTRAL_LANDMARK_MAX_NEIGHBORS) {
            break;
          }
        }

        if (neighborCount >= SPECTRAL_LANDMARK_MAX_NEIGHBORS) {
          break;
        }
      }
    });
  });

  return landmarks;
}

function extractSpectralPeakBands(frame) {
  if (!frame?.length) {
    return [];
  }

  const candidates = [];
  frame.forEach((value, index) => {
    const left = index > 0 ? frame[index - 1] : 0;
    const right = index + 1 < frame.length ? frame[index + 1] : 0;
    if (value >= SPECTRAL_LANDMARK_MIN_PEAK && value >= left && value >= right) {
      candidates.push({ index, value });
    }
  });

  if (!candidates.length) {
    return [...frame]
      .map((value, index) => ({ index, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, SPECTRAL_LANDMARK_PEAKS_PER_FRAME)
      .map((item) => item.index);
  }

  return candidates
    .sort((left, right) => right.value - left.value)
    .slice(0, SPECTRAL_LANDMARK_PEAKS_PER_FRAME)
    .map((item) => item.index);
}

function goertzelMagnitude(frame, sampleRate, targetFrequency) {
  if (!frame?.length || targetFrequency <= 0) {
    return 0;
  }

  const frameSize = frame.length;
  if (frameSize < 4) {
    return 0;
  }

  const k = Math.max(1, Math.round(0.5 + (frameSize * targetFrequency) / sampleRate));
  const omega = (2 * Math.PI * k) / frameSize;
  const coefficient = 2 * Math.cos(omega);
  let q0 = 0;
  let q1 = 0;
  let q2 = 0;

  for (let index = 0; index < frameSize; index += 1) {
    q0 = coefficient * q1 - q2 + frame[index];
    q2 = q1;
    q1 = q0;
  }

  const real = q1 - q2 * Math.cos(omega);
  const imaginary = q2 * Math.sin(omega);
  return Math.sqrt(real * real + imaginary * imaginary);
}

function refreshDistinctiveReferenceSegments() {
  const readyReferences = state.references.filter(
    (reference) => reference.analysisStatus === "ready" && reference.features,
  );
  if (readyReferences.length < 2) {
    return;
  }

  readyReferences.forEach((reference) => {
    const segments = Array.isArray(reference.features?.strongSegments)
      ? reference.features.strongSegments
      : [];
    if (!segments.length) {
      return;
    }

    const rescored = segments
      .filter((segment) => segment?.features)
      .map((segment) => {
        const distinctiveness = estimateSegmentDistinctiveness(segment.features, reference.id, readyReferences);
        const fieldDistinctiveness = estimateFieldSegmentDistinctiveness(segment.features, reference.id, readyReferences);
        const baseScore = Number(segment.baseScore ?? segment.score ?? 0);
        return {
          ...segment,
          baseScore,
          distinctiveness,
          fieldDistinctiveness,
          score: baseScore + distinctiveness * 16 + fieldDistinctiveness * 18,
        };
      })
      .sort((left, right) =>
        right.score - left.score ||
        right.fieldDistinctiveness - left.fieldDistinctiveness ||
        right.distinctiveness - left.distinctiveness);

    const selected = [];
    rescored.forEach((segment) => {
      if (selected.every((item) => Math.abs(item.startSeconds - segment.startSeconds) > 4)) {
        selected.push(segment);
      }
    });

    reference.features.strongSegments = selected.slice(0, MAX_REFERENCE_SEGMENTS);
  });
}

function estimateSegmentDistinctiveness(segmentFeatures, ownerId, references) {
  let maxSimilarity = 0;
  references.forEach((reference) => {
    if (reference.id === ownerId) {
      return;
    }

    iterateReferenceVariantFeatures(reference).forEach((variantFeatures) => {
      const similarity = measureReferenceFeatureSimilarity(segmentFeatures, variantFeatures);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
      }
    });
  });

  return clamp(1 - maxSimilarity, 0, 1);
}

function estimateFieldSegmentDistinctiveness(segmentFeatures, ownerId, references) {
  let maxSimilarity = 0;
  references.forEach((reference) => {
    if (reference.id === ownerId) {
      return;
    }

    iterateReferenceVariantFeatures(reference).forEach((variantFeatures) => {
      const similarity = measureFieldReferenceSimilarity(segmentFeatures, variantFeatures);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
      }
    });
  });

  return clamp(1 - maxSimilarity, 0, 1);
}

function iterateReferenceVariantFeatures(reference) {
  if (!reference?.features) {
    return [];
  }

  const variants = [reference.features];
  const segments = Array.isArray(reference.features.strongSegments)
    ? reference.features.strongSegments
    : [];
  segments.slice(0, Math.min(MAX_REFERENCE_SEGMENTS, 5)).forEach((segment) => {
    if (segment?.features) {
      variants.push(segment.features);
    }
  });
  return variants;
}

function measureReferenceFeatureSimilarity(left, right) {
  const onsetSimilarity = clamp(1 - vectorDistance(left?.onset || [], right?.onset || []), 0, 1);
  const envelopeSimilarity = clamp(1 - vectorDistance(left?.envelope || [], right?.envelope || []), 0, 1);
  const intervalSimilarity = clamp(1 - vectorDistance(left?.intervals || [], right?.intervals || []), 0, 1);
  const spectralSimilarity = clamp(
    1 - vectorDistance(left?.spectralProfile || [], right?.spectralProfile || []),
    0,
    1,
  );
  const fluxSimilarity = clamp(1 - vectorDistance(left?.spectralFlux || [], right?.spectralFlux || []), 0, 1);
  const tempoSimilarity = clamp(
    1 - Math.abs((left?.tempoEstimate || 0) - (right?.tempoEstimate || 0)) / 180,
    0,
    1,
  );
  const densitySimilarity = clamp(1 - Math.abs((left?.density || 0) - (right?.density || 0)), 0, 1);
  const fingerprintSimilarity = fingerprintHashSimilarity(left?.fingerprints || [], right?.fingerprints || []);
  const landmarkSimilarity = fingerprintHashSimilarity(left?.spectralLandmarks || [], right?.spectralLandmarks || []);

  return clamp(
    onsetSimilarity * 0.18 +
    envelopeSimilarity * 0.16 +
    intervalSimilarity * 0.15 +
    spectralSimilarity * 0.16 +
    fluxSimilarity * 0.12 +
    fingerprintSimilarity * 0.08 +
    landmarkSimilarity * 0.11 +
    tempoSimilarity * 0.04 +
    densitySimilarity * 0.02,
    0,
    1,
  );
}

function measureFieldReferenceSimilarity(left, right) {
  const onsetSimilarity = clamp(1 - vectorDistance(left?.onset || [], right?.onset || []), 0, 1);
  const envelopeSimilarity = clamp(1 - vectorDistance(left?.envelope || [], right?.envelope || []), 0, 1);
  const intervalSimilarity = clamp(1 - vectorDistance(left?.intervals || [], right?.intervals || []), 0, 1);
  const spectralSimilarity = clamp(
    1 - vectorDistance(left?.spectralProfile || [], right?.spectralProfile || []),
    0,
    1,
  );
  const fluxSimilarity = clamp(1 - vectorDistance(left?.spectralFlux || [], right?.spectralFlux || []), 0, 1);
  const tempoSimilarity = clamp(
    1 - Math.abs((left?.tempoEstimate || 0) - (right?.tempoEstimate || 0)) / 180,
    0,
    1,
  );
  const densitySimilarity = clamp(1 - Math.abs((left?.density || 0) - (right?.density || 0)), 0, 1);
  const landmarkSimilarity = fingerprintHashSimilarity(left?.spectralLandmarks || [], right?.spectralLandmarks || []);

  return clamp(
    onsetSimilarity * 0.18 +
    envelopeSimilarity * 0.2 +
    intervalSimilarity * 0.16 +
    spectralSimilarity * 0.16 +
    fluxSimilarity * 0.1 +
    landmarkSimilarity * 0.13 +
    tempoSimilarity * 0.05 +
    densitySimilarity * 0.02,
    0,
    1,
  );
}

function fingerprintHashSimilarity(left, right) {
  const leftHashes = new Set(left.map((item) => item?.hash).filter(Boolean));
  const rightHashes = new Set(right.map((item) => item?.hash).filter(Boolean));
  if (!leftHashes.size || !rightHashes.size) {
    return 0;
  }

  let shared = 0;
  leftHashes.forEach((hash) => {
    if (rightHashes.has(hash)) {
      shared += 1;
    }
  });
  return shared / Math.max(leftHashes.size, rightHashes.size);
}

function isUsableCapture(features, modeKey = state.settings.analysisMode) {
  return (
    features.rms >= detectionLimit("minSignalRms", modeKey) &&
    features.peakAmplitude >= detectionLimit("minSignalPeak", modeKey) &&
    features.peaksCount >= detectionLimit("minCapturePeaks", modeKey) &&
    features.peakRate >= detectionLimit("minPeakRate", modeKey) &&
    features.fingerprintsCount >= detectionLimit("minCaptureFingerprints", modeKey) &&
    features.signalQuality >= detectionLimit("minSignalQuality", modeKey) &&
    features.onsetContrast >= detectionLimit("minOnsetContrast", modeKey) &&
    features.rhythmicStability >= detectionLimit("minRhythmicStability", modeKey)
  );
}

function buildRhythmFingerprints(peakTimes) {
  const fingerprints = [];

  for (let anchorIndex = 0; anchorIndex < peakTimes.length; anchorIndex += 1) {
    const anchorTime = peakTimes[anchorIndex];
    const maxSecondIndex = Math.min(peakTimes.length - 1, anchorIndex + FINGERPRINT_MAX_NEIGHBORS);

    for (let secondIndex = anchorIndex + 1; secondIndex <= maxSecondIndex; secondIndex += 1) {
      const firstInterval = peakTimes[secondIndex] - anchorTime;
      if (firstInterval <= 0 || firstInterval > FINGERPRINT_MAX_INTERVAL_SECONDS) {
        continue;
      }

      const maxThirdIndex = Math.min(peakTimes.length - 1, secondIndex + FINGERPRINT_MAX_NEIGHBORS);
      for (let thirdIndex = secondIndex + 1; thirdIndex <= maxThirdIndex; thirdIndex += 1) {
        const secondInterval = peakTimes[thirdIndex] - peakTimes[secondIndex];
        const totalInterval = peakTimes[thirdIndex] - anchorTime;
        if (
          secondInterval <= 0 ||
          secondInterval > FINGERPRINT_MAX_INTERVAL_SECONDS ||
          totalInterval > FINGERPRINT_MAX_INTERVAL_SECONDS
        ) {
          continue;
        }

        fingerprints.push({
          hash: `${quantizeInterval(firstInterval)}:${quantizeInterval(secondInterval)}`,
          time: anchorTime,
        });
      }
    }
  }

  return fingerprints;
}

function quantizeInterval(seconds) {
  return Math.max(1, Math.round(seconds / FINGERPRINT_INTERVAL_STEP));
}

function normalizeSignal(signal) {
  let max = 0;
  for (let index = 0; index < signal.length; index += 1) {
    const absolute = Math.abs(signal[index]);
    if (absolute > max) {
      max = absolute;
    }
  }

  if (!max) {
    return signal;
  }

  const normalized = new Float32Array(signal.length);
  for (let index = 0; index < signal.length; index += 1) {
    normalized[index] = signal[index] / max;
  }

  return normalized;
}

function buildEnvelope(signal) {
  const frameSize = ANALYSIS_WINDOW;
  const hop = frameSize / 2;
  const frames = [];

  for (let start = 0; start + frameSize < signal.length; start += hop) {
    let energy = 0;
    for (let index = start; index < start + frameSize; index += 1) {
      energy += signal[index] * signal[index];
    }
    frames.push(Math.sqrt(energy / frameSize));
  }

  return smoothVector(normalizeArray(frames), 4);
}

function buildOnsetProfile(envelope) {
  const onset = envelope.map((value, index) => {
    if (index === 0) {
      return 0;
    }
    return Math.max(0, value - envelope[index - 1]);
  });

  return smoothVector(normalizeArray(onset), 2);
}

function detectPeaks(onset) {
  const peaks = [];
  const sorted = [...onset].sort((left, right) => left - right);
  const percentileIndex = Math.floor(sorted.length * 0.78);
  const adaptiveThreshold = sorted[percentileIndex] || 0;
  const threshold = Math.max(detectionLimit("minOnsetThreshold"), adaptiveThreshold * 0.85);

  for (let index = 1; index < onset.length - 1; index += 1) {
    const value = onset[index];
    if (value > threshold && value > onset[index - 1] && value >= onset[index + 1]) {
      peaks.push(index);
    }
  }

  return peaks;
}

function buildIntervalProfile(peakIndexes, sampleRate) {
  const bins = 16;
  const histogram = Array.from({ length: bins }, () => 0);
  const hopDuration = (ANALYSIS_WINDOW / 2) / sampleRate;
  const minInterval = 0.08;
  const maxInterval = 2;
  const logMin = Math.log(minInterval);
  const logRange = Math.log(maxInterval) - logMin;

  for (let index = 1; index < peakIndexes.length; index += 1) {
    const intervalSeconds = (peakIndexes[index] - peakIndexes[index - 1]) * hopDuration;
    if (intervalSeconds < minInterval || intervalSeconds > maxInterval) {
      continue;
    }

    const position = (Math.log(intervalSeconds) - logMin) / logRange;
    const bin = Math.max(0, Math.min(bins - 1, Math.floor(position * bins)));
    histogram[bin] += 1;
  }

  return normalizeArray(histogram);
}

function estimateTempo(peakIndexes, sampleRate) {
  if (peakIndexes.length < 2) {
    return 0;
  }

  const hopDuration = (ANALYSIS_WINDOW / 2) / sampleRate;
  const intervals = [];

  for (let index = 1; index < peakIndexes.length; index += 1) {
    intervals.push((peakIndexes[index] - peakIndexes[index - 1]) * hopDuration);
  }

  intervals.sort((left, right) => left - right);
  const median = intervals[Math.floor(intervals.length / 2)];
  if (!median) {
    return 0;
  }

  return Math.max(0, Math.min(260, 60 / median));
}

function compareAgainstReferences(inputFeatures, references, modeKey) {
  const preset = MODE_PRESETS[modeKey] || MODE_PRESETS.fast;
  const readyReferences = references.filter(
    (reference) => reference.analysisStatus === "ready" && reference.features,
  );
  const scored = readyReferences.map((reference) => {
    const variants = buildReferenceFeatureVariants(reference);
    const scoredVariants = variants
      .map((variant) => scoreReferenceVariant(inputFeatures, reference, variant, preset, modeKey));
    return aggregateReferenceVariantScores(scoredVariants, modeKey);
  });

  if (modeKey === "field") {
    applyFieldLeadershipBonuses(scored);
  }

  scored.sort((left, right) => compareVariantScores(left, right, modeKey));
  const best = modeKey === "field" ? scored[0]?.fieldRankingScore ?? 0 : scored[0]?.distance ?? 1;
  const second = modeKey === "field"
    ? scored[1]?.fieldRankingScore ?? Math.max(0, best - 0.1)
    : scored[1]?.distance ?? best + 0.1;

  const matches = scored.map((item, index) => {
    const separationBoost = modeKey !== "field" && index === 0 && item.evidenceScore >= detectionLimit("minMatchEvidence", modeKey)
      ? Math.max(0, Math.min(8, (second - best) * 36))
      : 0;
    const confidenceBase = modeKey === "field"
      ? item.fieldRankingScore * 0.72 + item.signalAdjustedSimilarity * 0.28
      : item.signalAdjustedSimilarity;
    const confidence = Math.round(clamp(confidenceBase * 100 + separationBoost, 0, 98));
    const match = {
      ...item,
      confidence,
    };

    return {
      ...match,
      displayConfidence: modeKey === "field" ? getVisibleConfidence(match) : confidence,
    };
  });
  matches.sort((left, right) => (
    modeKey === "field"
      ? right.fieldRankingScore - left.fieldRankingScore ||
        right.confidence - left.confidence ||
        left.distance - right.distance
      : right.confidence - left.confidence || left.distance - right.distance
  ));
  return matches.slice(0, MATCHES_LIMIT);
}

function aggregateReferenceVariantScores(scoredVariants, modeKey) {
  const sorted = [...scoredVariants].sort((left, right) => compareVariantScores(left, right, modeKey));
  const best = sorted[0];
  if (!best) {
    return null;
  }

  const bestAlignment = getReferenceAlignedSeconds(best);
  const toleranceSeconds = modeKey === "field" ? 2.5 : 1.8;
  const bestRanking = modeKey === "field" ? best.fieldRankingScore : best.signalAdjustedSimilarity;
  const consistentVariants = sorted.filter((item) => {
    const alignedSeconds = getReferenceAlignedSeconds(item);
    const ranking = modeKey === "field" ? item.fieldRankingScore : item.signalAdjustedSimilarity;
    return Math.abs(alignedSeconds - bestAlignment) <= toleranceSeconds &&
      ranking >= bestRanking - (modeKey === "field" ? 0.08 : 0.05);
  });

  const supportWeight = consistentVariants.reduce((sum, item, index) => {
    if (index === 0) {
      return sum + 1;
    }
    const ranking = modeKey === "field" ? item.fieldRankingScore : item.signalAdjustedSimilarity;
    return sum + Math.max(0.16, Math.min(0.65, ranking / Math.max(0.01, bestRanking))) * 0.55;
  }, 0);
  const variantConsensus = clamp((supportWeight - 1) / 1.8, 0, 1);
  const variantSupportCount = consistentVariants.length;
  const diagnostics = {
    ...best.diagnostics,
    variantConsensus,
    variantSupportCount,
  };
  const aggregateBonus = modeKey === "field"
    ? variantConsensus * 0.07 + Math.min(0.03, Math.max(0, variantSupportCount - 1) * 0.01)
    : variantConsensus * 0.03;

  return {
    ...best,
    evidenceScore: clamp(best.evidenceScore + aggregateBonus * (modeKey === "field" ? 0.55 : 0.35), 0, 1),
    signalAdjustedSimilarity: clamp(best.signalAdjustedSimilarity * (1 + aggregateBonus * 0.4), 0, 1),
    fieldRankingScore: modeKey === "field"
      ? clamp(best.fieldRankingScore + aggregateBonus, 0, 1)
      : best.fieldRankingScore,
    diagnostics,
  };
}

function getReferenceAlignedSeconds(item) {
  const startSeconds = item?.referenceVariant?.startSeconds || 0;
  const hopSeconds = item?.referenceFeatures?.hopSeconds || item?.alignment?.hopSeconds || 0.023;
  const offset = item?.alignment?.offset || 0;
  return startSeconds + offset * hopSeconds;
}

function compareVariantScores(left, right, modeKey) {
  if (modeKey === "field") {
    return right.fieldRankingScore - left.fieldRankingScore ||
      (right.diagnostics.fieldLeadershipBonus || 0) - (left.diagnostics.fieldLeadershipBonus || 0) ||
      right.diagnostics.patternScore - left.diagnostics.patternScore ||
      right.diagnostics.timbreScore - left.diagnostics.timbreScore ||
      right.evidenceScore - left.evidenceScore ||
      left.distance - right.distance;
  }

  return left.distance - right.distance;
}

function buildReferenceFeatureVariants(reference) {
  const variants = [
    {
      type: "full",
      startSeconds: 0,
      durationSeconds: reference.features.durationSeconds,
      features: reference.features,
    },
  ];
  const segments = Array.isArray(reference.features.strongSegments)
    ? reference.features.strongSegments
    : [];

  segments.forEach((segment) => {
    if (!segment?.features) {
      return;
    }
    variants.push({
      type: "segment",
      startSeconds: segment.startSeconds || 0,
      durationSeconds: segment.durationSeconds || segment.features.durationSeconds || 0,
      score: segment.score || 0,
      features: segment.features,
    });
  });

  return variants;
}

function scoreReferenceVariant(inputFeatures, reference, variant, preset, modeKey) {
  const referenceFeatures = variant.features;
  const slowPatternProfile = isSlowPatternProfile(inputFeatures, referenceFeatures);
  const referenceHopSeconds = referenceFeatures.hopSeconds || inputFeatures.hopSeconds || 0.023;
  const targetWindowLength = Math.max(2, Math.round(inputFeatures.durationSeconds / referenceHopSeconds));
  const rhythmMatch = bestSubsequenceMatch(
    inputFeatures.onsetSeries,
    referenceFeatures.onsetSeries,
    null,
    targetWindowLength,
  );
  const envelopeMatch = bestSubsequenceMatch(
    inputFeatures.envelopeSeries,
    referenceFeatures.envelopeSeries,
    rhythmMatch.offset,
    rhythmMatch.windowLength,
  );
  const spectralFluxMatch = bestSubsequenceMatch(
    inputFeatures.spectralFluxSeries || [],
    referenceFeatures.spectralFluxSeries || [],
    rhythmMatch.offset,
    rhythmMatch.windowLength,
  );
  const landmarkMatch = compareSpectralLandmarks(
    inputFeatures.spectralLandmarks || [],
    referenceFeatures.spectralLandmarks || [],
  );
  const fingerprintMatch = compareRhythmFingerprints(
    inputFeatures.fingerprints,
    referenceFeatures.fingerprints,
  );
  const fingerprintDistance = 1 - fingerprintMatch.similarity;
  const rhythmDistance = 1 - rhythmMatch.similarity;
  const envelopeDistance = 1 - envelopeMatch.similarity;
  const spectralDistance = vectorDistance(
    inputFeatures.spectralProfile || [],
    referenceFeatures.spectralProfile || [],
  );
  const intervalDistance = vectorDistance(inputFeatures.intervals, referenceFeatures.intervals);
  const densityDistance = Math.abs(inputFeatures.density - referenceFeatures.density);
  const peaksDistance = Math.abs(inputFeatures.peakRate - referenceFeatures.peakRate) / 8;
  const tempoDistance =
    inputFeatures.tempoEstimate && referenceFeatures.tempoEstimate
      ? Math.abs(inputFeatures.tempoEstimate - referenceFeatures.tempoEstimate) / 180
      : 0.15;

  const weights = preset.weights;
  const distance =
    fingerprintDistance * weights.fingerprint +
    rhythmDistance * weights.rhythm +
    envelopeDistance * weights.envelope +
    intervalDistance * weights.interval +
    densityDistance * weights.density +
    tempoDistance * weights.tempo +
    peaksDistance * weights.peaks +
    spectralDistance * weights.spectral +
    (1 - spectralFluxMatch.similarity) * weights.flux;
  const absoluteSimilarity = clamp(1 - distance / 1.1, 0, 1);
  const diagnostics = buildMatchDiagnostics(
    rhythmMatch,
    envelopeMatch,
    spectralFluxMatch,
    landmarkMatch,
    fingerprintMatch,
    intervalDistance,
    densityDistance,
    spectralDistance,
    tempoDistance,
    peaksDistance,
    slowPatternProfile,
    modeKey,
  );
  const evidenceScore = estimateMatchEvidence(
    inputFeatures,
    rhythmMatch,
    envelopeMatch,
    fingerprintMatch,
    absoluteSimilarity,
    diagnostics,
    modeKey,
  );
  const adjustedEvidence = modeKey === "field"
    ? evidenceScore * (1 - diagnostics.microphonePenalty * 0.45)
    : evidenceScore;
  const fieldPatternLift = modeKey === "field"
    ? clamp(
      0.82 +
      diagnostics.patternScore * 0.13 +
      diagnostics.timbreScore * 0.1 +
      (diagnostics.slowPatternProfile ? 0.02 : 0) +
      (diagnostics.fieldLeadershipBonus || 0) * 0.45,
      0.74,
      1.1,
    )
    : 1;
  const signalAdjustedSimilarity =
    absoluteSimilarity *
    clamp(inputFeatures.signalQuality, 0, 1) *
    adjustedEvidence *
    (1 - diagnostics.microphonePenalty) *
    fieldPatternLift;
  const fieldRankingScore = modeKey === "field"
    ? clamp(
      signalAdjustedSimilarity * 0.38 +
      diagnostics.patternScore * 0.24 +
      diagnostics.timbreScore * 0.21 +
      diagnostics.rhythmSimilarity * 0.05 +
      diagnostics.envelopeSimilarity * 0.05 +
      diagnostics.spectralSimilarity * 0.05 +
      diagnostics.spectralFluxSimilarity * 0.02 +
      diagnostics.segmentConsistency * 0.07 +
      (diagnostics.slowPatternProfile ? 0.02 : 0) +
      (diagnostics.fieldLeadershipBonus || 0),
      0,
      1,
    )
    : clamp(1 - distance, 0, 1);

  return {
    reference,
    referenceFeatures,
    referenceVariant: {
      type: variant.type,
      startSeconds: variant.startSeconds,
      durationSeconds: variant.durationSeconds,
      score: variant.score || 0,
    },
    distance,
    absoluteSimilarity,
    signalAdjustedSimilarity,
    fieldRankingScore,
    evidenceScore: adjustedEvidence,
    rawEvidenceScore: evidenceScore,
    diagnostics,
    alignment: {
      ...rhythmMatch,
      fingerprintSimilarity: fingerprintMatch.similarity,
      fingerprintOffsetSeconds: fingerprintMatch.offsetSeconds,
      fingerprintVotes: fingerprintMatch.votes,
    },
    confidence: 0,
  };
}

function buildMatchDiagnostics(
  rhythmMatch,
  envelopeMatch,
  spectralFluxMatch,
  landmarkMatch,
  fingerprintMatch,
  intervalDistance,
  densityDistance,
  spectralDistance,
  tempoDistance,
  peaksDistance,
  slowPatternProfile,
  modeKey,
) {
  const intervalSimilarity = clamp(1 - intervalDistance, 0, 1);
  const densitySimilarity = clamp(1 - densityDistance, 0, 1);
  const spectralSimilarity = clamp(1 - spectralDistance, 0, 1);
  const spectralFluxSimilarity = spectralFluxMatch.similarity;
  const landmarkSimilarity = landmarkMatch.similarity;
  const tempoSimilarity = clamp(1 - tempoDistance, 0, 1);
  const peaksSimilarity = clamp(1 - peaksDistance, 0, 1);
  const fingerprintStrength = clamp(fingerprintMatch.similarity / 0.35, 0, 1);
  const timbreScore = clamp(
    spectralSimilarity * 0.5 +
    spectralFluxSimilarity * 0.2 +
    landmarkSimilarity * 0.3,
    0,
    1,
  );
  const patternScore = clamp(
    slowPatternProfile
      ? rhythmMatch.similarity * 0.23 +
        envelopeMatch.similarity * 0.27 +
        intervalSimilarity * 0.22 +
        timbreScore * 0.2 +
        tempoSimilarity * 0.05 +
        peaksSimilarity * 0.03
      : rhythmMatch.similarity * 0.29 +
        envelopeMatch.similarity * 0.23 +
        intervalSimilarity * 0.17 +
        timbreScore * 0.22 +
        tempoSimilarity * 0.05 +
        peaksSimilarity * 0.04,
    0,
    1,
  );
  const patternDominance = clamp((patternScore - fingerprintStrength + 0.2) / 0.38, 0, 1);
  const segmentConsistency = clamp(
    rhythmMatch.similarity * 0.42 +
    envelopeMatch.similarity * 0.24 +
    intervalSimilarity * 0.18 +
    spectralSimilarity * 0.06 +
    spectralFluxSimilarity * 0.04 +
    landmarkSimilarity * 0.06,
    0,
    1,
  );
  const microphonePenalty = modeKey === "field"
    ? clamp(
      Math.max(0, (slowPatternProfile ? 0.76 : 0.72) - patternScore) * 0.42 +
      Math.max(0, fingerprintStrength - patternScore - (slowPatternProfile ? 0.1 : 0.04)) * 0.26,
      0,
      slowPatternProfile ? 0.24 : 0.3,
    )
    : 0;

  return {
    rhythmSimilarity: rhythmMatch.similarity,
    envelopeSimilarity: envelopeMatch.similarity,
    fingerprintSimilarity: fingerprintMatch.similarity,
    fingerprintStrength,
    intervalSimilarity,
    densitySimilarity,
    spectralSimilarity,
    spectralFluxSimilarity,
    landmarkSimilarity,
    landmarkVotes: landmarkMatch.votes,
    timbreScore,
    tempoSimilarity,
    peaksSimilarity,
    patternScore,
    patternDominance,
    segmentConsistency,
    microphonePenalty,
    slowPatternProfile,
    fieldLeadershipBonus: 0,
  };
}

function estimateMatchEvidence(
  inputFeatures,
  rhythmMatch,
  envelopeMatch,
  fingerprintMatch,
  absoluteSimilarity,
  diagnostics,
  modeKey,
) {
  const slowPatternProfile = diagnostics.slowPatternProfile;
  const dominantPattern = diagnostics.patternDominance >= 0.58 || diagnostics.patternScore >= (slowPatternProfile ? 0.8 : 0.84);
  const voteInfluence = dominantPattern ? 1 : 0.28;
  const fingerprintInfluence = dominantPattern ? 1 : 0.45;
  const voteScore = clamp(
    fingerprintMatch.votes / Math.max(
      slowPatternProfile ? 2 : detectionLimit("minFingerprintVotes", modeKey),
      inputFeatures.fingerprintsCount * (slowPatternProfile ? 0.22 : 0.28),
    ),
    0,
    1,
  );
  const fingerprintScore = clamp(fingerprintMatch.similarity / 0.35, 0, 1);
  const rhythmScore = clamp(rhythmMatch.similarity / 0.72, 0, 1);
  const envelopeScore = clamp(envelopeMatch.similarity / 0.72, 0, 1);
  const absoluteScore = clamp(absoluteSimilarity / 0.62, 0, 1);

  if (modeKey === "field") {
    return clamp(
      diagnostics.patternScore * (slowPatternProfile ? 0.28 : 0.27) +
      diagnostics.timbreScore * (slowPatternProfile ? 0.22 : 0.2) +
      rhythmScore * (slowPatternProfile ? 0.09 : 0.11) +
      envelopeScore * (slowPatternProfile ? 0.13 : 0.12) +
      diagnostics.intervalSimilarity * (slowPatternProfile ? 0.12 : 0.1) +
      diagnostics.spectralSimilarity * 0.06 +
      diagnostics.spectralFluxSimilarity * 0.04 +
      diagnostics.landmarkSimilarity * 0.1 +
      diagnostics.segmentConsistency * 0.08 +
      absoluteScore * 0.05 +
      inputFeatures.rhythmicStability * 0.05 +
      fingerprintScore * 0.03 * fingerprintInfluence +
      voteScore * 0.01 * voteInfluence +
      (diagnostics.fieldLeadershipBonus || 0) * 0.2,
      0,
      1,
    );
  }

  return clamp(
    fingerprintScore * 0.28 +
    voteScore * 0.24 +
    rhythmScore * 0.2 +
    absoluteScore * 0.18 +
    inputFeatures.rhythmicStability * 0.1,
    0,
    1,
  );
}

function isReliableMatch(match, settings) {
  const modeKey = settings.analysisMode;
  const diagnostics = match.diagnostics || {};
  const minimumConfidence = Math.max(detectionLimit("minMatchConfidence", modeKey), settings.minimumConfidence);
  const minimumVotes = modeKey === "field" && diagnostics.slowPatternProfile ? 1 : detectionLimit("minFingerprintVotes", modeKey);
  const hasFingerprintSupport =
    match.alignment.fingerprintVotes >= minimumVotes &&
    (
      match.alignment.fingerprintSimilarity >= detectionLimit("minFingerprintSimilarity", modeKey) ||
      match.alignment.similarity >= detectionLimit("minRhythmSimilarity", modeKey)
    );
  const hasStrongFieldPattern = modeKey === "field" &&
    match.alignment.fingerprintVotes >= (diagnostics.slowPatternProfile ? 1 : 2) &&
    diagnostics.patternScore >= (diagnostics.slowPatternProfile ? 0.82 : 0.84) &&
    diagnostics.rhythmSimilarity >= (diagnostics.slowPatternProfile ? 0.72 : 0.78) &&
    diagnostics.envelopeSimilarity >= (diagnostics.slowPatternProfile ? 0.82 : 0.78) &&
    diagnostics.intervalSimilarity >= (diagnostics.slowPatternProfile ? 0.7 : 0.62) &&
      diagnostics.timbreScore >= (diagnostics.slowPatternProfile ? 0.72 : 0.76) &&
    diagnostics.segmentConsistency >= (diagnostics.slowPatternProfile ? 0.78 : 0.8) &&
    diagnostics.landmarkSimilarity >= (diagnostics.slowPatternProfile ? 0.32 : 0.36);
  const confirmationConfidence = modeKey === "field" && !hasStrongFieldPattern
    ? Math.max(minimumConfidence, diagnostics.slowPatternProfile ? 52 : 55)
    : minimumConfidence;

  return (
    match.confidence >= confirmationConfidence &&
    match.absoluteSimilarity >= detectionLimit("minMatchAbsoluteSimilarity", modeKey) &&
    match.evidenceScore >= detectionLimit("minMatchEvidence", modeKey) &&
    (hasFingerprintSupport || hasStrongFieldPattern)
  );
}

function getMatchAmbiguity(matches, modeKey = state.settings.analysisMode) {
  const best = matches[0];
  if (!best || matches.length < 2) {
    return null;
  }

  const bestStrongLeader = modeKey === "field" && isStrongFieldLeader(best);
  const minimumMargin = modeKey === "field" && bestStrongLeader
    ? Math.max(6, detectionLimit("minTopMatchMargin", modeKey) - 3)
    : detectionLimit("minTopMatchMargin", modeKey);
  const minimumPlausibleConfidence = Math.max(
    detectionLimit("minMatchConfidence", modeKey) - 8,
    state.settings.minimumConfidence - 8,
  ) + (modeKey === "field" && bestStrongLeader ? 4 : 0);

  return matches.slice(1).find((candidate) => {
    const margin = best.confidence - candidate.confidence;
    const diagnostics = candidate.diagnostics || {};
    const hasPlausibleVotes =
      candidate.alignment.fingerprintVotes >= Math.max(diagnostics.slowPatternProfile ? 1 : 2, detectionLimit("minFingerprintVotes", modeKey) - 2);
    const hasPlausibleFieldPattern = modeKey === "field" &&
      candidate.alignment.fingerprintVotes >= (diagnostics.slowPatternProfile ? 1 : 2) &&
      diagnostics.patternScore >= (diagnostics.slowPatternProfile ? 0.78 : 0.8) &&
      diagnostics.rhythmSimilarity >= (diagnostics.slowPatternProfile ? 0.68 : 0.74) &&
      diagnostics.envelopeSimilarity >= (diagnostics.slowPatternProfile ? 0.78 : 0.72) &&
      diagnostics.intervalSimilarity >= (diagnostics.slowPatternProfile ? 0.66 : 0.58) &&
      diagnostics.timbreScore >= (diagnostics.slowPatternProfile ? 0.68 : 0.7) &&
      diagnostics.segmentConsistency >= (diagnostics.slowPatternProfile ? 0.74 : 0.76) &&
      diagnostics.landmarkSimilarity >= (diagnostics.slowPatternProfile ? 0.24 : 0.28);
    const candidateIsPlausible =
      candidate.confidence >= minimumPlausibleConfidence &&
      candidate.evidenceScore >= detectionLimit("minMatchEvidence", modeKey) + (modeKey === "field" && bestStrongLeader ? 0.03 : 0) &&
      (hasPlausibleVotes || hasPlausibleFieldPattern);

    return margin <= minimumMargin && candidateIsPlausible;
  }) || null;
}

function isStrongFieldLeader(match) {
  const diagnostics = match?.diagnostics || {};
  return (
    diagnostics.patternScore >= 0.84 &&
    diagnostics.timbreScore >= 0.67 &&
    diagnostics.envelopeSimilarity >= 0.82 &&
    diagnostics.segmentConsistency >= 0.79 &&
    diagnostics.landmarkSimilarity >= 0.34 &&
    match.evidenceScore >= detectionLimit("minMatchEvidence", "field") + 0.08
  );
}

function isProbableFieldMatch(match) {
  const diagnostics = match?.diagnostics || {};
  return (
    match &&
    match.confidence >= Math.max(state.settings.minimumConfidence + 10, 58) &&
    diagnostics.patternScore >= 0.8 &&
    diagnostics.timbreScore >= 0.64 &&
    diagnostics.envelopeSimilarity >= 0.78 &&
    diagnostics.segmentConsistency >= 0.74 &&
    diagnostics.landmarkSimilarity >= 0.3
  );
}

function applyFieldLeadershipBonuses(scored) {
  if (scored.length < 2) {
    return;
  }

  const maxPattern = Math.max(...scored.map((item) => item.diagnostics?.patternScore || 0));
  const maxEnvelope = Math.max(...scored.map((item) => item.diagnostics?.envelopeSimilarity || 0));
  const maxSpectral = Math.max(...scored.map((item) => item.diagnostics?.spectralSimilarity || 0));
  const maxLandmark = Math.max(...scored.map((item) => item.diagnostics?.landmarkSimilarity || 0));
  const maxSegmentConsistency = Math.max(...scored.map((item) => item.diagnostics?.segmentConsistency || 0));

  scored.forEach((item) => {
    const diagnostics = item.diagnostics || {};
    const leadsPattern = diagnostics.patternScore >= Math.max(0.8, maxPattern - 0.015);
    const leadsEnvelope = diagnostics.envelopeSimilarity >= Math.max(0.76, maxEnvelope - 0.02);
    const leadsSpectral = diagnostics.spectralSimilarity >= Math.max(0.74, maxSpectral - 0.02);
    const leadsLandmark = diagnostics.landmarkSimilarity >= Math.max(0.3, maxLandmark - 0.03);
    const leadsSegmentConsistency =
      diagnostics.segmentConsistency >= Math.max(0.76, maxSegmentConsistency - 0.02);
    const tripleLead = leadsPattern && leadsEnvelope && (leadsSpectral || leadsLandmark);
    const segmentLead = leadsPattern && leadsSegmentConsistency && leadsLandmark;
    const dualLead = leadsPattern && (leadsEnvelope || leadsSpectral || leadsSegmentConsistency || leadsLandmark);
    const bonus = tripleLead ? 0.05 : segmentLead ? 0.042 : dualLead ? 0.022 : 0;
    diagnostics.fieldLeadershipBonus = bonus;
    item.fieldRankingScore = clamp(item.fieldRankingScore + bonus, 0, 1);
  });
}

function isSlowPatternProfile(inputFeatures, referenceFeatures) {
  const inputTempo = Number(inputFeatures?.tempoEstimate || 0);
  const referenceTempo = Number(referenceFeatures?.tempoEstimate || 0);
  const peakRate = Number(inputFeatures?.peakRate || 0);
  const slowTempo = (inputTempo > 0 && inputTempo <= 58) || (referenceTempo > 0 && referenceTempo <= 58);
  const nearSlowTempo = (inputTempo > 0 && inputTempo <= 66) || (referenceTempo > 0 && referenceTempo <= 66);
  return slowTempo || (nearSlowTempo && peakRate <= 1.2);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getVisibleConfidence(match) {
  const actualConfidence = Number(match?.confidence || 0);
  const diagnostics = match?.diagnostics || {};
  if (!match || state.settings.analysisMode !== "field") {
    return actualConfidence;
  }

  const hasClearPatternLead =
    diagnostics.patternScore >= 0.82 &&
    diagnostics.timbreScore >= 0.68 &&
    diagnostics.envelopeSimilarity >= 0.78;
  if (!hasClearPatternLead) {
    return actualConfidence;
  }

  const lift = Math.round(
    diagnostics.patternScore * 3 +
    diagnostics.timbreScore * 3 +
    diagnostics.envelopeSimilarity * 2 +
    (diagnostics.fieldLeadershipBonus || 0) * 40,
  );

  return Math.max(actualConfidence, Math.min(98, actualConfidence + Math.max(2, Math.min(8, lift))));
}

function compareRhythmFingerprints(queryFingerprints, targetFingerprints) {
  if (!queryFingerprints?.length || !targetFingerprints?.length) {
    return { similarity: 0, offsetSeconds: 0, votes: 0 };
  }

  const targetByHash = new Map();
  for (const fingerprint of targetFingerprints) {
    const matches = targetByHash.get(fingerprint.hash) || [];
    matches.push(fingerprint.time);
    targetByHash.set(fingerprint.hash, matches);
  }

  const offsetVotes = new Map();
  let sharedHashes = 0;
  let votes = 0;

  for (const fingerprint of queryFingerprints) {
    const targetTimes = targetByHash.get(fingerprint.hash);
    if (!targetTimes) {
      continue;
    }

    sharedHashes += 1;
    for (const targetTime of targetTimes) {
      const offsetKey = Math.round((targetTime - fingerprint.time) / FINGERPRINT_OFFSET_STEP);
      offsetVotes.set(offsetKey, (offsetVotes.get(offsetKey) || 0) + 1);
      votes += 1;
    }
  }

  if (!offsetVotes.size) {
    return { similarity: 0, offsetSeconds: 0, votes: 0 };
  }

  let bestOffsetKey = 0;
  let bestVotes = 0;
  for (const [offsetKey, count] of offsetVotes.entries()) {
    if (count > bestVotes) {
      bestOffsetKey = offsetKey;
      bestVotes = count;
    }
  }

  const coverage = sharedHashes / Math.max(1, queryFingerprints.length);
  const coherence = bestVotes / Math.max(1, votes);
  const voteStrength = clamp(bestVotes / Math.max(3, queryFingerprints.length * 0.55), 0, 1);

  return {
    similarity: clamp(coverage * 0.45 + coherence * 0.25 + voteStrength * 0.3, 0, 1),
    offsetSeconds: bestOffsetKey * FINGERPRINT_OFFSET_STEP,
    votes: bestVotes,
  };
}

function compareSpectralLandmarks(queryLandmarks, targetLandmarks) {
  if (!queryLandmarks?.length || !targetLandmarks?.length) {
    return { similarity: 0, offsetSeconds: 0, votes: 0 };
  }

  const targetByHash = new Map();
  for (const landmark of targetLandmarks) {
    const matches = targetByHash.get(landmark.hash) || [];
    matches.push(landmark.time);
    targetByHash.set(landmark.hash, matches);
  }

  const offsetVotes = new Map();
  let sharedHashes = 0;
  let votes = 0;

  for (const landmark of queryLandmarks) {
    const targetTimes = targetByHash.get(landmark.hash);
    if (!targetTimes) {
      continue;
    }

    sharedHashes += 1;
    for (const targetTime of targetTimes) {
      const offsetKey = Math.round((targetTime - landmark.time) / CAPTURE_FRAME_SECONDS);
      offsetVotes.set(offsetKey, (offsetVotes.get(offsetKey) || 0) + 1);
      votes += 1;
    }
  }

  if (!offsetVotes.size) {
    return { similarity: 0, offsetSeconds: 0, votes: 0 };
  }

  let bestOffsetKey = 0;
  let bestVotes = 0;
  for (const [offsetKey, count] of offsetVotes.entries()) {
    if (count > bestVotes) {
      bestOffsetKey = offsetKey;
      bestVotes = count;
    }
  }

  const coverage = sharedHashes / Math.max(1, queryLandmarks.length);
  const coherence = bestVotes / Math.max(1, votes);
  const voteStrength = clamp(bestVotes / Math.max(2, queryLandmarks.length * 0.4), 0, 1);

  return {
    similarity: clamp(coverage * 0.38 + coherence * 0.24 + voteStrength * 0.38, 0, 1),
    offsetSeconds: bestOffsetKey * CAPTURE_FRAME_SECONDS,
    votes: bestVotes,
  };
}

function bestSubsequenceMatch(query, target, preferredOffset = null, targetWindowLength = query?.length || 0) {
  if (!query?.length || !target?.length) {
    return { similarity: 0, offset: 0, windowLength: 0 };
  }

  const windowLength = Math.max(2, Math.min(target.length, Math.round(targetWindowLength || query.length)));
  const comparableQuery = resampleVector(query, windowLength);

  if (target.length <= windowLength) {
    return {
      similarity: normalizedCorrelation(resampleVector(query, Math.max(target.length, 2)), target),
      offset: 0,
      windowLength: target.length,
    };
  }

  if (Number.isFinite(preferredOffset)) {
    const offset = Math.max(0, Math.min(target.length - windowLength, Math.round(preferredOffset)));
    return {
      similarity: normalizedCorrelation(comparableQuery, target.slice(offset, offset + windowLength)),
      offset,
      windowLength,
    };
  }

  const stride = Math.max(1, Math.floor(windowLength / SUBSEQUENCE_STRIDE_DIVISOR));
  let best = { similarity: -1, offset: 0 };

  for (let offset = 0; offset <= target.length - windowLength; offset += stride) {
    const similarity = normalizedCorrelation(comparableQuery, target.slice(offset, offset + windowLength));
    if (similarity > best.similarity) {
      best = { similarity, offset };
    }
  }

  const refinedStart = Math.max(0, best.offset - stride + 1);
  const refinedEnd = Math.min(target.length - windowLength, best.offset + stride - 1);
  for (let offset = refinedStart; offset <= refinedEnd; offset += 1) {
    const similarity = normalizedCorrelation(comparableQuery, target.slice(offset, offset + windowLength));
    if (similarity > best.similarity) {
      best = { similarity, offset };
    }
  }

  return {
    similarity: Math.max(0, Math.min(1, best.similarity)),
    offset: best.offset,
    windowLength,
  };
}

function normalizedCorrelation(left, right) {
  const size = Math.min(left.length, right.length);
  if (!size) {
    return 0;
  }

  let leftMean = 0;
  let rightMean = 0;
  for (let index = 0; index < size; index += 1) {
    leftMean += left[index];
    rightMean += right[index];
  }
  leftMean /= size;
  rightMean /= size;

  let numerator = 0;
  let leftEnergy = 0;
  let rightEnergy = 0;
  for (let index = 0; index < size; index += 1) {
    const leftCentered = left[index] - leftMean;
    const rightCentered = right[index] - rightMean;
    numerator += leftCentered * rightCentered;
    leftEnergy += leftCentered * leftCentered;
    rightEnergy += rightCentered * rightCentered;
  }

  const denominator = Math.sqrt(leftEnergy * rightEnergy);
  if (!denominator) {
    return 0;
  }

  return (numerator / denominator + 1) / 2;
}

function vectorDistance(left, right) {
  const size = Math.max(left.length, right.length);
  let sum = 0;

  for (let index = 0; index < size; index += 1) {
    const a = left[index] ?? left[left.length - 1] ?? 0;
    const b = right[index] ?? right[right.length - 1] ?? 0;
    const delta = a - b;
    sum += delta * delta;
  }

  return Math.sqrt(sum / size);
}

function resampleVector(vector, targetSize) {
  if (!vector.length) {
    return Array.from({ length: targetSize }, () => 0);
  }

  if (vector.length === targetSize) {
    return [...vector];
  }

  const output = [];
  const lastIndex = vector.length - 1;

  for (let index = 0; index < targetSize; index += 1) {
    const position = (index / (targetSize - 1)) * lastIndex;
    const base = Math.floor(position);
    const mix = position - base;
    const left = vector[base];
    const right = vector[Math.min(base + 1, lastIndex)];
    output.push(left + (right - left) * mix);
  }

  return output;
}

function smoothVector(vector, radius) {
  return vector.map((_, index) => {
    let sum = 0;
    let count = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const value = vector[index + offset];
      if (typeof value === "number") {
        sum += value;
        count += 1;
      }
    }
    return count ? sum / count : 0;
  });
}

function normalizeArray(values) {
  const max = Math.max(...values, 0);
  if (!max) {
    return values.map(() => 0);
  }
  return values.map((value) => value / max);
}

function prettifyFileName(filename) {
  return filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildAssetUrl(filename) {
  return `./assets/pasos/${encodeURIComponent(filename)}`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "Desconocido";
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatSampleRate(sampleRate) {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    return "Desconocido";
  }

  return `${(sampleRate / 1000).toFixed(1)} kHz`;
}

function formatLastModified(timestamp) {
  if (!timestamp) {
    return "Desconocido";
  }

  try {
    return new Date(timestamp).toLocaleDateString("es-ES");
  } catch (error) {
    return "Desconocido";
  }
}

function getAnalysisStatusLabel(reference) {
  if (reference.analysisStatus === "ready" && reference.features) {
    return "Listo";
  }

  if (reference.analysisStatus === "failed") {
    return "Error análisis";
  }

  return "Analizando";
}

function getAnalysisStatusClass(reference) {
  if (reference.analysisStatus === "ready" && reference.features) {
    return "is-ready";
  }

  if (reference.analysisStatus === "failed") {
    return "is-error";
  }

  return "is-pending";
}

function renderLibrary() {
  renderTagFilterOptions();
  const filteredReferences = getFilteredReferences();

  if (!state.references.length) {
    elements.libraryGrid.innerHTML =
      `<div class="empty-state empty-state--library">
        <strong>Sin toques cargados</strong>
        <span>Entra en Subir para añadir mp3 locales o copia audios en assets/pasos para crear la base común.</span>
      </div>`;
    refreshHeaderStats();
    return;
  }

  if (!filteredReferences.length) {
    elements.libraryGrid.innerHTML =
      `<div class="empty-state empty-state--library">
        <strong>Sin resultados</strong>
        <span>Cambia la búsqueda o selecciona otro tipo de toque.</span>
      </div>`;
    refreshHeaderStats();
    return;
  }

  elements.libraryGrid.innerHTML = filteredReferences
    .map(
      (reference) => {
        const isReady = reference.analysisStatus === "ready" && reference.features;
        const statusLabel = getAnalysisStatusLabel(reference);
        const statusClass = getAnalysisStatusClass(reference);
        const tagVisualClass = getTagVisualClass(reference.tag);
        const referenceInitials = getReferenceInitials(reference);
        const isCollapsed = state.collapsedReferences.has(reference.id);
        return `
        <article class="library-item ${isCollapsed ? "is-collapsed" : ""} ${statusClass} ${tagVisualClass}">
          <div class="library-cover" aria-hidden="true">
            <span>${escapeHtml(referenceInitials)}</span>
          </div>
          <header>
            <div class="library-title-block">
              <strong>${escapeHtml(reference.name)}</strong>
              <span class="library-compact-meta">
                ${escapeHtml(reference.tag || DEFAULT_TAG)} · ${formatDuration(reference.duration)} · ${escapeHtml(statusLabel)}
              </span>
            </div>
            <span class="tag-badge ${statusClass}">${escapeHtml(statusLabel)}</span>
          </header>
          <div class="metadata-editor collapsible-detail">
            <label>
              <span>Nombre visible</span>
              <input
                class="editable-name"
                type="text"
                value="${escapeHtml(reference.name)}"
                data-name-input="${reference.id}"
                data-metadata-input="${reference.id}"
                aria-label="Nombre visible del toque"
              />
            </label>
            <label>
              <span>Notas internas</span>
              <textarea
                class="mobile-textarea"
                rows="3"
                maxlength="500"
                data-notes-input="${reference.id}"
                data-metadata-input="${reference.id}"
                placeholder="Ejemplo: cofradía, procedencia, calidad de grabación..."
              >${escapeHtml(reference.notes || "")}</textarea>
            </label>
          </div>
          <div class="library-meta-grid collapsible-detail">
            <small>Origen: ${escapeHtml(reference.source)}</small>
            <small>Archivo: ${escapeHtml(reference.filename)}</small>
            <small>Duración real: ${formatDuration(reference.duration)}</small>
            <small>Tamaño: ${formatFileSize(reference.fileSize)}</small>
            <small>Formato: ${escapeHtml(reference.mimeType || "Desconocido")}</small>
            <small>Muestreo: ${formatSampleRate(reference.sampleRate)}</small>
            <small>Canales: ${reference.channels || "Desconocido"}</small>
            <small>Fecha archivo: ${formatLastModified(reference.lastModified)}</small>
          </div>
          <div class="analysis-note collapsible-detail">
            <small>Estado análisis: ${escapeHtml(statusLabel)}</small>
            <small>Tempo estimado: ${isReady ? Math.round(reference.features.tempoEstimate || 0) : 0} bpm</small>
            <small>Golpes estimados: ${isReady ? reference.features.peaksCount : 0}</small>
          </div>
          <label class="tag-editor collapsible-detail">
            <span>Tipo de toque</span>
            <select class="mobile-select compact-select" data-tag-select="${reference.id}">
              ${renderTagOptions(reference.tag || DEFAULT_TAG)}
            </select>
          </label>
          <div class="library-actions" aria-label="Acciones de ${escapeHtml(reference.name)}">
            <button class="inline-button" type="button" data-action="preview" data-id="${reference.id}" aria-label="Escuchar ${escapeHtml(reference.name)}">
              Escuchar
            </button>
            <button class="inline-button" type="button" data-action="rename" data-id="${reference.id}" aria-label="Guardar ficha de ${escapeHtml(reference.name)}">
              Guardar ficha
            </button>
            ${renderReferenceSecondaryAction(reference, isCollapsed)}
          </div>
        </article>
      `;
      },
    )
    .join("");

  refreshHeaderStats();
}

function renderMatches(matches) {
  if (!matches.length) {
    elements.matchesList.innerHTML =
      '<div class="empty-state">Todavía no hay coincidencias calculadas.</div>';
    return;
  }

  elements.matchesList.innerHTML = matches
    .map((match, index) => {
      const visibleConfidence = match.displayConfidence ?? match.confidence;
      const isWeak = match.confidence < state.settings.minimumConfidence;
      return `
        <article class="match-item">
          <div class="match-rank">${index + 1}</div>
          <div>
            <strong class="match-title">${escapeHtml(match.reference.name)}</strong>
            <div class="match-subtitle">${escapeHtml(
              isWeak ? "Coincidencia débil, revisar patrón" : match.reference.source,
            )}</div>
          </div>
          <div class="match-score">${visibleConfidence}%</div>
        </article>
      `;
    })
    .join("");
}

function renderHistory() {
  if (!state.history.length) {
    elements.historyList.innerHTML =
      '<div class="empty-state">Todavía no hay detecciones guardadas en este dispositivo.</div>';
    refreshHeaderStats();
    return;
  }

  elements.historyList.innerHTML = state.history
    .map(
      (entry) => `
        <article class="history-item">
          <header>
            <strong>${escapeHtml(entry.name)}</strong>
            <span class="history-score">${entry.confidence}%</span>
          </header>
          <div class="history-meta">${escapeHtml(entry.meta)}</div>
          <div class="history-time">${escapeHtml(entry.timeLabel)}</div>
        </article>
      `,
    )
    .join("");

  refreshHeaderStats();
}

function renderTagFilterOptions() {
  const tags = new Set(normalizeTagList(state.availableTags));
  state.references.forEach((reference) => tags.add(reference.tag || DEFAULT_TAG));
  const selected = state.adminFilters.tag;
  elements.adminTagFilter.innerHTML = [
    '<option value="all">Todos</option>',
    ...[...tags].sort().map((tag) => {
      const isSelected = selected === tag ? " selected" : "";
      return `<option value="${escapeHtml(tag)}"${isSelected}>${escapeHtml(tag)}</option>`;
    }),
  ].join("");
  renderAdminTagChips([...tags].sort());
}

function renderReferenceSecondaryAction(reference, isCollapsed) {
  if (reference.origin === "manifest") {
    return `
      <button class="inline-button" type="button" data-action="toggle-details" data-id="${reference.id}" aria-label="${isCollapsed ? "Expandir" : "Contraer"} ${escapeHtml(reference.name)}">
        ${isCollapsed ? "Expandir" : "Contraer"}
      </button>
    `;
  }

  return `
    <button class="inline-button danger-inline" type="button" data-action="remove" data-id="${reference.id}" aria-label="Quitar ${escapeHtml(reference.name)}">
      Quitar
    </button>
  `;
}

function toggleReferenceDetails(referenceId) {
  const reference = state.references.find((item) => item.id === referenceId);
  if (!reference) {
    return;
  }

  if (state.collapsedReferences.has(referenceId)) {
    if (reference.origin === "manifest") {
      state.references.forEach((item) => {
        if (item.origin === "manifest") {
          state.collapsedReferences.add(item.id);
        }
      });
    }
    state.collapsedReferences.delete(referenceId);
  } else {
    state.collapsedReferences.add(referenceId);
  }

  renderLibrary();
}

function renderTagOptions(selectedTag) {
  const tags = new Set(normalizeTagList([...state.availableTags, selectedTag]));
  return [...tags]
    .sort()
    .map((tag) => {
      const selected = tag === selectedTag ? " selected" : "";
      return `<option value="${escapeHtml(tag)}"${selected}>${escapeHtml(tag)}</option>`;
    })
    .join("");
}

function renderAdminTagChips(tags) {
  if (!elements.adminTagChips) {
    return;
  }

  elements.adminTagChips.innerHTML = tags
    .map((tag) => {
      const removable = tag !== DEFAULT_TAG;
      return `
        <span class="tag-chip">
          <span>${escapeHtml(tag)}</span>
          ${
            removable
              ? `<button type="button" data-tag-remove="${escapeHtml(tag)}" aria-label="Borrar etiqueta ${escapeHtml(tag)}">×</button>`
              : ""
          }
        </span>
      `;
    })
    .join("");
}

async function addAdminTag() {
  const nextTag = elements.adminNewTagInput?.value?.trim();
  if (!nextTag) {
    return;
  }

  state.availableTags = normalizeTagList([...state.availableTags, nextTag]);
  elements.adminNewTagInput.value = "";
  const saved = await saveGlobalMetadataFile();
  renderLibrary();
  showAdminMetadataStatus(saved ? "Tipo global guardado." : "Tipo añadido en esta sesión.");
}

async function removeAdminTag(tagToRemove) {
  const cleanTag = String(tagToRemove || "").trim();
  if (!cleanTag || cleanTag === DEFAULT_TAG) {
    return;
  }

  state.availableTags = normalizeTagList(state.availableTags.filter((tag) => tag !== cleanTag));

  for (const reference of state.references) {
    if (reference.tag !== cleanTag) {
      continue;
    }

    reference.tag = DEFAULT_TAG;
    if (reference.isPersistent && reference.persistedBlob instanceof Blob) {
      await savePersistentReference(reference, reference.persistedBlob);
    }
  }

  if (state.adminFilters.tag === cleanTag) {
    state.adminFilters.tag = "all";
  }

  const saved = await saveGlobalMetadataFile();
  renderLibrary();
  showAdminMetadataStatus(
    saved
      ? `Tipo "${cleanTag}" borrado. Las referencias afectadas pasan a "${DEFAULT_TAG}".`
      : `Tipo "${cleanTag}" borrado en esta sesión.`,
  );
}

function markMetadataDraft(referenceId) {
  const reference = state.references.find((item) => item.id === referenceId);
  if (!reference) {
    return;
  }

  reference.metadataDirty = true;
  showAdminMetadataStatus("Hay cambios sin guardar en una ficha.");
}

function showAdminMetadataStatus(message, isError = false) {
  if (!elements.adminMetadataStatus) {
    return;
  }

  elements.adminMetadataStatus.hidden = false;
  elements.adminMetadataStatus.textContent = message;
  elements.adminMetadataStatus.classList.toggle("is-error", isError);
}

function getFilteredReferences() {
  return state.references.filter((reference) => {
    const tag = reference.tag || DEFAULT_TAG;
    const matchesTag = state.adminFilters.tag === "all" || tag === state.adminFilters.tag;
    const haystack =
      `${reference.name} ${reference.filename} ${reference.source} ${tag} ${reference.notes || ""}`.toLowerCase();
    const matchesSearch = !state.adminFilters.search || haystack.includes(state.adminFilters.search);
    return matchesTag && matchesSearch;
  });
}

function updateStatus(kind, text) {
  elements.statusPill.className = `status-pill ${kind}`;
  elements.statusPill.textContent = text;
}

function setAppLoadingState(isLoading, options = {}) {
  if (!elements.startupOverlay) {
    return;
  }

  document.body.classList.toggle("app-loading", isLoading);
  document.body.setAttribute("aria-busy", isLoading ? "true" : "false");
  elements.startupOverlay.hidden = !isLoading;

  if (options.title && elements.startupTitle) {
    elements.startupTitle.textContent = options.title;
  }
  if (options.meta && elements.startupMeta) {
    elements.startupMeta.textContent = options.meta;
  }
  if (typeof options.progress === "number") {
    const safeProgress = Math.max(0, Math.min(100, Math.round(options.progress)));
    elements.startupProgressBar.style.width = `${safeProgress}%`;
    elements.startupProgressLabel.textContent = `${safeProgress}%`;
    elements.startupProgress?.setAttribute("aria-valuenow", String(safeProgress));
  }

  if (isLoading) {
    elements.startupCard?.focus({ preventScroll: true });
  }

  [document.querySelector(".app-shell"), elements.localModeBanner].forEach((container) => {
    if (!container) {
      return;
    }
    if (isLoading) {
      container.setAttribute("inert", "");
      container.setAttribute("aria-hidden", "true");
    } else {
      container.removeAttribute("inert");
      container.removeAttribute("aria-hidden");
    }
  });

  const disabled = Boolean(isLoading);
  [
    elements.listenButton,
    elements.modeToggleButton,
    elements.shareResultButton,
    elements.repeatResultButton,
    elements.captureDuration,
    elements.minimumConfidence,
    elements.analysisMode,
    elements.fileInput,
    elements.clearLibraryButton,
    elements.clearHistoryButton,
    elements.adminSelectFilesButton,
  ].forEach((control) => {
    if (control) {
      control.disabled = disabled;
    }
  });
}

function updateBootManifestProgress(processed, total, message) {
  if (!elements.startupOverlay?.hidden) {
    const ratio = total > 0 ? processed / total : 1;
    const progress = 62 + ratio * 24;
    setAppLoadingState(true, {
      title: "Cargando base común",
      meta: `${message} ${processed}/${total || 0} referencias revisadas.`,
      progress,
    });
  }
}

function updateResult({ name, meta, confidence, matches, analysis }) {
  elements.matchName.textContent = name;
  elements.matchMeta.textContent = meta;
  elements.confidenceValue.textContent = `${confidence}%`;
  elements.confidenceRing.style.setProperty("--confidence-angle", `${confidence * 3.6}deg`);
  elements.capturedTempo.textContent = analysis?.tempoEstimate
    ? `${Math.round(analysis.tempoEstimate)} bpm`
    : "0 bpm";
  elements.capturedPeaks.textContent = String(analysis?.peaksCount ?? 0);
  renderMatches(matches);
  state.lastResult = { name, meta, confidence, matches, analysis };
}

function formatMatchMeta(match, analysis) {
  const matchedFeatures = match.referenceFeatures || match.reference.features;
  const tempo = Math.round(matchedFeatures.tempoEstimate || match.reference.features.tempoEstimate || 0);
  const captured = Math.round(analysis?.tempoEstimate || 0);
  const variantStart = match.referenceVariant?.startSeconds || 0;
  const offsetSeconds = variantStart + (match.alignment?.offset || 0) * (matchedFeatures.hopSeconds || 0);
  const fragmentText = offsetSeconds > 1
    ? ` Fragmento parecido sobre ${formatDuration(offsetSeconds)} de la referencia.`
    : "";
  return `Coincidencia principal contra "${match.reference.name}" con patrón rítmico muy próximo. Captado: ${captured || 0} bpm. Referencia: ${tempo || 0} bpm.${fragmentText}`;
}

function formatCaptureDiagnostics(analysis) {
  if (!analysis) {
    return "";
  }

  return `Captado: ${Math.round(analysis.tempoEstimate || 0)} bpm, ${analysis.peaksCount || 0} golpes, calidad ${Math.round((analysis.signalQuality || 0) * 100)}%.`;
}

function formatWindowDiagnostics(candidate) {
  if (!candidate || candidate.isFullCapture) {
    return "";
  }

  return ` Tramo analizado: ${formatDuration(candidate.durationSeconds)} desde ${formatDuration(candidate.startSeconds)}.`;
}

function buildCaptureAdvice(analysis) {
  if (!analysis) {
    return "No se pudo medir la calidad de la grabación. Vuelve a intentarlo acercando el móvil al sonido.";
  }

  const diagnostics = formatCaptureDiagnostics(analysis);
  const details = [];
  if (analysis.peakAmplitude >= 0.98) {
    details.push("la entrada está saturada; baja el volumen del altavoz o la ganancia del micrófono");
  }
  if (analysis.rms < detectionLimit("minSignalRms")) {
    details.push("la señal llega baja; sube un poco el volumen o acerca el móvil");
  }
  if (analysis.peaksCount < detectionLimit("minCapturePeaks")) {
    details.push("se han detectado pocos golpes; deja sonar el toque completo unos segundos más");
  }
  if (analysis.fingerprintsCount < detectionLimit("minCaptureFingerprints")) {
    details.push("hay poco patrón rítmico útil; evita ruido de fondo y eco");
  }
  if (analysis.signalQuality < detectionLimit("minSignalQuality")) {
    details.push("la calidad rítmica es baja; coloca el móvil frente al altavoz, no pegado");
  }

  const advice = details.length
    ? details.join(". ")
    : "la captura no se parece lo suficiente a una referencia; prueba con menos ruido y 30-80 cm de distancia al altavoz";

  return `${diagnostics} ${advice}.`;
}

function pushHistory(bestMatch, analysis, uncertain) {
  const entry = {
    id: crypto.randomUUID(),
    name: uncertain ? `${bestMatch.reference.name} (dudoso)` : bestMatch.reference.name,
    confidence: getVisibleConfidence(bestMatch),
    meta: `${Math.round(analysis.tempoEstimate || 0)} bpm · ${analysis.peaksCount} golpes`,
    timeLabel: new Date().toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };

  state.history.unshift(entry);
  state.history = state.history.slice(0, HISTORY_LIMIT);
  persistHistory();
  renderHistory();
}

function clearHistory() {
  state.history = [];
  persistHistory();
  renderHistory();
}

async function clearLibrary() {
  state.references
    .filter((reference) => reference.origin === "local-upload")
    .forEach(revokeReferencePreview);
  state.references = state.references.filter((reference) => reference.origin !== "local-upload");
  refreshDistinctiveReferenceSegments();
  state.adminFilters.search = "";
  state.adminFilters.tag = "all";
  elements.adminSearchInput.value = "";
  await clearPersistentReferences();
  renderLibrary();
  updateStatus("ready", "Cargas locales borradas");
}

async function removeReference(referenceId) {
  const index = state.references.findIndex((reference) => reference.id === referenceId);
  if (index < 0) {
    return;
  }

  resetPreviewButtons();
  const reference = state.references[index];
  revokeReferencePreview(state.references[index]);
  state.references.splice(index, 1);
  if (reference.isPersistent) {
    await deletePersistentReference(reference.id);
  }
  refreshDistinctiveReferenceSegments();
  renderLibrary();
}

async function saveReferenceName(referenceId) {
  const reference = state.references.find((item) => item.id === referenceId);
  if (!reference) {
    return;
  }

  const input = document.querySelector(`[data-name-input="${referenceId}"]`);
  const notesInput = document.querySelector(`[data-notes-input="${referenceId}"]`);
  const nextName = input?.value?.trim();
  if (!nextName) {
    return;
  }

  reference.name = nextName;
  reference.notes = notesInput?.value?.trim() || "";
  reference.metadataDirty = false;
  await syncPersistentReference(reference);
  renderLibrary();
  showAdminMetadataStatus("Ficha guardada.");
}

async function retagReference(referenceId, nextTag) {
  const reference = state.references.find((item) => item.id === referenceId);
  if (!reference) {
    return;
  }

  if (!nextTag) {
    return;
  }

  reference.tag = nextTag.trim() || DEFAULT_TAG;
  reference.metadataDirty = false;
  await syncPersistentReference(reference);
  renderLibrary();
  showAdminMetadataStatus("Tipo actualizado.");
}

function revokeReferencePreview(reference) {
  if (reference.previewType === "object-url" && reference.previewUrl) {
    URL.revokeObjectURL(reference.previewUrl);
  }
  if (reference.previewAudio) {
    reference.previewAudio.pause();
    reference.previewAudio = null;
  }
}

function stopReferencePreviews() {
  state.references.forEach((reference) => {
    if (!reference.previewAudio) {
      return;
    }

    reference.previewAudio.pause();
    reference.previewAudio.currentTime = 0;
  });
  resetPreviewButtons();
}

async function previewReference(referenceId, button) {
  const reference = state.references.find((item) => item.id === referenceId);
  if (!reference?.previewUrl) {
    return;
  }

  if (!reference.previewAudio) {
    reference.previewAudio = new Audio(reference.previewUrl);
  }

  if (!reference.previewAudio.paused) {
    reference.previewAudio.pause();
    reference.previewAudio.currentTime = 0;
    resetPreviewButtons();
    button.textContent = "Escuchar";
    return;
  }

  stopReferencePreviews();

  button.textContent = "Parar";
  reference.previewAudio.onended = () => {
    button.textContent = "Escuchar";
  };

  try {
    await reference.previewAudio.play();
  } catch (error) {
    console.warn("No se pudo reproducir la referencia", error);
    button.textContent = "Escuchar";
  }
}

function resetPreviewButtons() {
  document.querySelectorAll('button[data-action="preview"]').forEach((button) => {
    button.textContent = "Escuchar";
  });
}

async function shareLastResult() {
  if (!state.lastResult) {
    return;
  }

  const text = `${state.lastResult.name} · confianza ${state.lastResult.confidence}% · ${state.lastResult.meta}`;
  try {
    if (navigator.share) {
      await navigator.share({
        title: "CofraBeat",
        text,
      });
      return;
    }

    await navigator.clipboard.writeText(text);
    updateStatus("ready", "Resultado copiado");
  } catch (error) {
    console.warn("No se pudo compartir el resultado", error);
  }
}

function registerServiceWorker() {
  if (!isFileProtocol() && !isDevelopmentHost() && "serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((error) => {
        console.warn("No se pudo registrar el service worker", error);
      });
  }
}

function isFileProtocol() {
  return window.location.protocol === "file:";
}

function renderRuntimeInfo() {
  if (!elements.runtimeInfo) {
    return;
  }

  if (isDevelopmentHost() || isFileProtocol()) {
    elements.runtimeInfo.hidden = false;
    elements.runtimeInfo.textContent =
      `Entorno: ${window.location.protocol}//${window.location.host || "(sin host)"}`;
    return;
  }

  if (isStaticPublicDemo()) {
    elements.runtimeInfo.hidden = false;
    elements.runtimeInfo.textContent = "GitHub Pages · demo publica";
  }
}

function isDevelopmentHost() {
  return ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
}

async function cleanupDevelopmentCaching() {
  if (!isDevelopmentHost()) {
    return;
  }

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("cofrabeat-"))
          .map((key) => caches.delete(key)),
      );
    }
  } catch (error) {
    console.warn("No se pudo limpiar la caché de desarrollo", error);
  }
}

async function showLocalHelp() {
  if (!elements.localHelpCard) {
    return;
  }

  if (state.uiMode !== "admin") {
    await toggleMode();
    if (state.uiMode !== "admin") {
      return;
    }
  }

  elements.localHelpCard.hidden = false;
  setAdminActivePanel("admin-info");
  updateBottomNavState("admin-info");
  scrollToSection(elements.localHelpCard, { center: true });
  flashSection(elements.localHelpCard);
}

function handleBottomNav(event) {
  const button = event.target.closest("[data-nav-target]");
  if (!button) {
    return;
  }

  const target = button.dataset.navTarget;
  if (target === "listen") {
    updateBottomNavState(target);
    toggleListening();
    return;
  }

  if (target.startsWith("admin-")) {
    openAdminPanel(target, { focusSearch: target === "admin-search" });
    return;
  }

  updateBottomNavState(target);
  const map = {
    detect: elements.detectSection,
    result: elements.resultSection,
    controls: elements.controlsSection,
    history: elements.historySection,
  };

  const targetSection = map[target];
  scrollToSection(targetSection);
  flashSection(targetSection);
}

function openAdminPanel(panel, { focusSearch = false } = {}) {
  if (panel !== "admin-library") {
    stopReferencePreviews();
  }

  setAdminActivePanel(panel);
  updateBottomNavState(panel);
  const targetSection = window.innerWidth < 700
    ? getAdminPanelElement(panel)
    : getAdminPanelElement(panel) || elements.adminPanelSection;

  scrollToSection(targetSection || elements.adminPanelSection);
  flashSection(targetSection || elements.adminPanelSection);
  if (focusSearch) {
    window.setTimeout(() => elements.adminSearchInput?.focus(), 180);
  }
}

function setAdminActivePanel(panel) {
  const nextPanel = getAdminPanelElement(panel) ? panel : "admin-panel";
  state.adminActivePanel = nextPanel;
  document.querySelectorAll("[data-admin-panel]").forEach((section) => {
    section.classList.toggle("is-active", section.dataset.adminPanel === nextPanel);
  });
}

function getAdminPanelElement(panel) {
  const map = {
    "admin-panel": elements.adminSummarySection,
    "admin-search": elements.adminToolsSection,
    "admin-upload": elements.adminUploadSection,
    "admin-library": elements.adminLibrarySection,
    "admin-info": elements.adminInfoSection,
  };

  return map[panel] || null;
}

function scrollToSection(section, { center = false } = {}) {
  if (!section) {
    return;
  }

  const topbarHeight = elements.modeToggleButton?.closest(".topbar")?.offsetHeight || 0;
  const safeOffset = window.innerWidth < 700 ? topbarHeight + 18 : 18;
  const sectionTop = section.getBoundingClientRect().top + window.scrollY;
  const targetTop = center
    ? sectionTop - Math.max(0, (window.innerHeight - section.offsetHeight) / 2)
    : sectionTop - safeOffset;

  window.scrollTo({
    top: Math.max(0, targetTop),
    behavior: "smooth",
  });
}

function flashSection(section) {
  if (!section) {
    return;
  }

  section.classList.remove("section-focus");
  window.requestAnimationFrame(() => {
    section.classList.add("section-focus");
    window.setTimeout(() => section.classList.remove("section-focus"), 720);
  });
}

function updateBottomNavState(target) {
  const activeNav = state.uiMode === "admin" ? elements.adminBottomNav : elements.userBottomNav;
  if (!activeNav) {
    return;
  }

  activeNav.querySelectorAll("[data-nav-target]").forEach((button) => {
    const isActive = button.dataset.navTarget === target;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-current", isActive ? "page" : "false");
  });
}

function showToast(title, message, kind = "info") {
  if (!elements.appToast) {
    return;
  }

  window.clearTimeout(state.toastTimer);
  elements.appToast.className = `app-toast app-toast--${kind}`;
  elements.appToastTitle.textContent = title;
  elements.appToastMessage.textContent = message;
  elements.appToast.hidden = false;

  window.requestAnimationFrame(() => {
    elements.appToast.classList.add("is-visible");
  });

  state.toastTimer = window.setTimeout(() => {
    elements.appToast.classList.remove("is-visible");
    window.setTimeout(() => {
      elements.appToast.hidden = true;
    }, 220);
  }, 4200);
}

function syncBottomNavByViewport() {
  if (state.uiMode === "admin") {
    if (window.innerWidth < 700) {
      updateBottomNavState(state.adminActivePanel || "admin-panel");
      return;
    }

    const sections = [
      ["admin-panel", elements.adminSummarySection],
      ["admin-search", elements.adminToolsSection],
      ["admin-upload", elements.adminUploadSection],
      ["admin-library", elements.adminLibrarySection],
      ["admin-info", elements.adminInfoSection],
    ].filter((entry) => entry[1]);

    const headerOffset = 120;
    let currentTarget = "admin-panel";
    let bestDistance = Number.POSITIVE_INFINITY;

    sections.forEach(([target, section]) => {
      const distance = Math.abs(section.getBoundingClientRect().top - headerOffset);
      if (distance < bestDistance) {
        bestDistance = distance;
        currentTarget = target;
      }
    });

    updateBottomNavState(currentTarget);
    return;
  }

  if (!elements.userBottomNav) {
    return;
  }

  const sections = [
    ["detect", elements.detectSection],
    ["result", elements.resultSection],
    ["controls", elements.controlsSection],
    ["history", elements.historySection],
  ].filter((entry) => entry[1]);

  const headerOffset = 120;
  let currentTarget = "detect";
  let bestDistance = Number.POSITIVE_INFINITY;

  sections.forEach(([target, section]) => {
    const distance = Math.abs(section.getBoundingClientRect().top - headerOffset);
    if (distance < bestDistance) {
      bestDistance = distance;
      currentTarget = target;
    }
  });

  if (currentTarget !== "history") {
    updateBottomNavState(currentTarget);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
