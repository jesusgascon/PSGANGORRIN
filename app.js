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
const SUBSEQUENCE_STRIDE_DIVISOR = 18;
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
const SETTINGS_SCHEMA_VERSION = 3;
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
    weights: { fingerprint: 0.32, rhythm: 0.28, envelope: 0.08, interval: 0.16, density: 0.06, tempo: 0.06, peaks: 0.04 },
  },
  field: {
    label: "Micro real",
    weights: { fingerprint: 0.26, rhythm: 0.3, envelope: 0.12, interval: 0.18, density: 0.06, tempo: 0.06, peaks: 0.02 },
  },
  balanced: {
    label: "Equilibrado",
    weights: { fingerprint: 0.36, rhythm: 0.24, envelope: 0.08, interval: 0.18, density: 0.06, tempo: 0.06, peaks: 0.02 },
  },
  strict: {
    label: "Más estricto",
    weights: { fingerprint: 0.42, rhythm: 0.2, envelope: 0.06, interval: 0.2, density: 0.04, tempo: 0.06, peaks: 0.02 },
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
    captureSeconds: 8,
    minimumConfidence: 62,
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
};

boot();

async function boot() {
  await cleanupDevelopmentCaching();
  renderRuntimeInfo();
  loadSavedState();
  await refreshAdminSession();
  bindEvents();
  setupMicrophonePermissionWatcher();
  await refreshMicrophoneStatus();
  syncSettingsUi();
  syncModeUi();
  await loadDetectionCalibration();
  updateStatus("idle", "Cargando referencias");
  await loadPersistedReferences();
  await loadManifestReferences();
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
    if (savedSettingsVersion < SETTINGS_SCHEMA_VERSION && state.settings.analysisMode === "fast") {
      state.settings.analysisMode = "field";
      state.settings.captureSeconds = Math.max(state.settings.captureSeconds, 8);
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

function detectionLimit(key) {
  return state.detectionLimits?.[key] ?? DEFAULT_DETECTION_LIMITS[key];
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

  if (state.processor?.port) {
    state.processor.port.onmessage = null;
  }
  state.processor?.disconnect();
  state.analyser?.disconnect();
  state.mediaSource?.disconnect();
  state.mediaStream?.getTracks().forEach((track) => track.stop());

  const inputSignal = flattenChunks(state.recordingChunks);
  cleanupListeningNodes();

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

  const features = analyseSignal(inputSignal, state.audioContext.sampleRate);
  if (!isUsableCapture(features)) {
    updateResult({
      name: "Sin toque detectable",
      meta: `La captura no tiene un patrón de tambor suficientemente claro. Nivel: ${Math.round(features.rms * 1000)} rms, golpes: ${features.peaksCount}, calidad: ${Math.round(features.signalQuality * 100)}%. Prueba con más volumen, menos ruido o acercando el micrófono.`,
      confidence: 0,
      matches: [],
      analysis: features,
    });
    updateStatus("idle", "Sin toque");
    resetIdleUi();
    return;
  }

  const results = compareAgainstReferences(features, state.references, state.settings.analysisMode);
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
  if (!isReliableMatch(bestMatch, state.settings) || ambiguity) {
    const ambiguityMeta = ambiguity
      ? `Resultado parecido entre "${bestMatch.reference.name}" y "${ambiguity.reference.name}". ${formatCaptureDiagnostics(features)} Repite la escucha con el tambor más claro para confirmar.`
      : `Resultado no concluyente tras ${capturedSeconds.toFixed(1)} s de escucha. ${formatCaptureDiagnostics(features)} Prueba con más volumen, menos ruido o acercando el micrófono.`;
    updateResult({
      name: ambiguity ? "Resultado ambiguo" : "Sin detección fiable",
      meta: ambiguityMeta,
      confidence: 0,
      matches: results,
      analysis: features,
    });
    updateStatus("idle", ambiguity ? "Ambiguo" : "No concluyente");
    resetIdleUi();
    return;
  }

  updateResult({
    name: bestMatch.reference.name,
    meta: formatMatchMeta(bestMatch, features),
    confidence: bestMatch.confidence,
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
      }
    }

    state.diagnostics.commonLoaded = loadedCount;
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
          } catch (error) {
            state.diagnostics.commonFailed += 1;
            markReferenceAnalysisFailed(`manifest:${entry.file}`);
            console.warn(`No se pudo procesar ${entry.file}`, error);
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

    refreshHeaderStats();
  } catch (error) {
    console.warn("No se pudo cargar el manifest de referencias", error);
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
      if (!entry.file || !entry.features || entry.error) {
        return;
      }

      featuresByFile.set(entry.file, entry);
    });
  } catch (error) {
    console.warn("No se pudieron cargar features precomputadas", error);
  }

  return featuresByFile;
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
  const features = analyseSignal(mono, buffer.sampleRate);
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

function analyseSignal(signal, sampleRate) {
  const rawStats = measureSignal(signal);
  const normalized = normalizeSignal(signal);
  const envelope = buildEnvelope(normalized);
  const onset = buildOnsetProfile(envelope);
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

  return {
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
    signalQuality: estimateSignalQuality(
      rawStats,
      peakIndexes.length,
      peakRate,
      onsetStats.contrast,
      rhythmicStability,
    ),
  };
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

function isUsableCapture(features) {
  return (
    features.rms >= detectionLimit("minSignalRms") &&
    features.peakAmplitude >= detectionLimit("minSignalPeak") &&
    features.peaksCount >= detectionLimit("minCapturePeaks") &&
    features.peakRate >= detectionLimit("minPeakRate") &&
    features.fingerprintsCount >= detectionLimit("minCaptureFingerprints") &&
    features.signalQuality >= detectionLimit("minSignalQuality") &&
    features.onsetContrast >= detectionLimit("minOnsetContrast") &&
    features.rhythmicStability >= detectionLimit("minRhythmicStability")
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
    const referenceHopSeconds = reference.features.hopSeconds || inputFeatures.hopSeconds || 0.023;
    const targetWindowLength = Math.max(2, Math.round(inputFeatures.durationSeconds / referenceHopSeconds));
    const rhythmMatch = bestSubsequenceMatch(
      inputFeatures.onsetSeries,
      reference.features.onsetSeries,
      null,
      targetWindowLength,
    );
    const envelopeMatch = bestSubsequenceMatch(
      inputFeatures.envelopeSeries,
      reference.features.envelopeSeries,
      rhythmMatch.offset,
      rhythmMatch.windowLength,
    );
    const fingerprintMatch = compareRhythmFingerprints(
      inputFeatures.fingerprints,
      reference.features.fingerprints,
    );
    const fingerprintDistance = 1 - fingerprintMatch.similarity;
    const rhythmDistance = 1 - rhythmMatch.similarity;
    const envelopeDistance = 1 - envelopeMatch.similarity;
    const intervalDistance = vectorDistance(inputFeatures.intervals, reference.features.intervals);
    const densityDistance = Math.abs(inputFeatures.density - reference.features.density);
    const peaksDistance = Math.abs(inputFeatures.peakRate - reference.features.peakRate) / 8;
    const tempoDistance =
      inputFeatures.tempoEstimate && reference.features.tempoEstimate
        ? Math.abs(inputFeatures.tempoEstimate - reference.features.tempoEstimate) / 180
        : 0.15;

    const weights = preset.weights;
    const distance =
      fingerprintDistance * weights.fingerprint +
      rhythmDistance * weights.rhythm +
      envelopeDistance * weights.envelope +
      intervalDistance * weights.interval +
      densityDistance * weights.density +
      tempoDistance * weights.tempo +
      peaksDistance * weights.peaks;
    const absoluteSimilarity = clamp(1 - distance / 1.1, 0, 1);
    const evidenceScore = estimateMatchEvidence(
      inputFeatures,
      rhythmMatch,
      fingerprintMatch,
      absoluteSimilarity,
    );
    const signalAdjustedSimilarity =
      absoluteSimilarity * clamp(inputFeatures.signalQuality, 0, 1) * evidenceScore;

    return {
      reference,
      distance,
      absoluteSimilarity,
      signalAdjustedSimilarity,
      evidenceScore,
      alignment: {
        ...rhythmMatch,
        fingerprintSimilarity: fingerprintMatch.similarity,
        fingerprintOffsetSeconds: fingerprintMatch.offsetSeconds,
        fingerprintVotes: fingerprintMatch.votes,
      },
      confidence: 0,
    };
  });

  scored.sort((left, right) => left.distance - right.distance);
  const best = scored[0]?.distance ?? 1;
  const second = scored[1]?.distance ?? best + 0.1;

  return scored.slice(0, MATCHES_LIMIT).map((item, index) => {
    const separationBoost = index === 0 && item.evidenceScore >= detectionLimit("minMatchEvidence")
      ? Math.max(0, Math.min(8, (second - best) * 36))
      : 0;
    const confidence = Math.round(clamp(item.signalAdjustedSimilarity * 100 + separationBoost, 0, 98));

    return {
      ...item,
      confidence,
    };
  });
}

function estimateMatchEvidence(inputFeatures, rhythmMatch, fingerprintMatch, absoluteSimilarity) {
  const voteScore = clamp(
    fingerprintMatch.votes / Math.max(detectionLimit("minFingerprintVotes"), inputFeatures.fingerprintsCount * 0.28),
    0,
    1,
  );
  const fingerprintScore = clamp(fingerprintMatch.similarity / 0.35, 0, 1);
  const rhythmScore = clamp(rhythmMatch.similarity / 0.72, 0, 1);
  const absoluteScore = clamp(absoluteSimilarity / 0.62, 0, 1);

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
  return (
    match.confidence >= Math.max(detectionLimit("minMatchConfidence"), settings.minimumConfidence) &&
    match.absoluteSimilarity >= detectionLimit("minMatchAbsoluteSimilarity") &&
    match.evidenceScore >= detectionLimit("minMatchEvidence") &&
    match.alignment.fingerprintVotes >= detectionLimit("minFingerprintVotes") &&
    (
      match.alignment.fingerprintSimilarity >= detectionLimit("minFingerprintSimilarity") ||
      match.alignment.similarity >= detectionLimit("minRhythmSimilarity")
    )
  );
}

function getMatchAmbiguity(matches) {
  const best = matches[0];
  const second = matches[1];
  if (!best || !second) {
    return null;
  }

  const margin = best.confidence - second.confidence;
  const minimumMargin = detectionLimit("minTopMatchMargin");
  const secondIsPlausible =
    second.confidence >= Math.max(detectionLimit("minMatchConfidence"), state.settings.minimumConfidence - 8) &&
    second.evidenceScore >= detectionLimit("minMatchEvidence") &&
    second.alignment.fingerprintVotes >= detectionLimit("minFingerprintVotes");

  return margin < minimumMargin && secondIsPlausible ? second : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
          <div class="match-score">${match.confidence}%</div>
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
  const tempo = Math.round(match.reference.features.tempoEstimate || 0);
  const captured = Math.round(analysis?.tempoEstimate || 0);
  const offsetSeconds = (match.alignment?.offset || 0) * (match.reference.features.hopSeconds || 0);
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

function pushHistory(bestMatch, analysis, uncertain) {
  const entry = {
    id: crypto.randomUUID(),
    name: uncertain ? `${bestMatch.reference.name} (dudoso)` : bestMatch.reference.name,
    confidence: bestMatch.confidence,
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
