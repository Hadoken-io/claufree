const startScreenEl = document.getElementById("startScreen");
const chatShellEl = document.getElementById("chatShell");
const startFormEl = document.getElementById("startForm");
const profileNameEl = document.getElementById("profileName");
const profileEmailEl = document.getElementById("profileEmail");
const profileConsentEl = document.getElementById("profileConsent");
const profileMetaEl = document.getElementById("profileMeta");

const railNewChatEl = document.getElementById("railNewChat");
const clearLocalDataEl = document.getElementById("clearLocalData");

const heroEl = document.getElementById("hero");
const chatEl = document.getElementById("chat");
const formEl = document.getElementById("composer");
const promptEl = document.getElementById("prompt");
const modelSelectEl = document.getElementById("modelSelect");
const refreshModelsEl = document.getElementById("refreshModels");
const newChatEl = document.getElementById("newChat");
const statusEl = document.getElementById("status");
const sendBtn = document.getElementById("sendButton");

const imageInputEl = document.getElementById("imageInput");
const attachImageEl = document.getElementById("attachImage");
const attachmentBarEl = document.getElementById("attachmentBar");
const attachmentNameEl = document.getElementById("attachmentName");
const removeImageEl = document.getElementById("removeImage");

const STORAGE_KEY = "claufree.puter.chat.v2";
const MAX_MESSAGE_CHARS = 2500;
const MAX_HISTORY_MESSAGES = 40;
const MAX_IMAGE_SIZE_BYTES = 6 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

const state = {
  models: [],
  selectedModel: "claude-opus-4-5",
  messages: [],
  isSending: false,
  hasStarted: false,
  profile: null,
  pendingImage: null
};

function setStatus(text) {
  statusEl.textContent = text;
}

function sanitizeProfile(profile) {
  if (!profile || typeof profile !== "object") return null;

  const name = typeof profile.name === "string" ? profile.name.trim() : "";
  const email = typeof profile.email === "string" ? profile.email.trim() : "";
  const consent = Boolean(profile.consent);

  if (!name || name.length > 70 || !consent) {
    return null;
  }

  return {
    name,
    email,
    consent,
    signedAt: profile.signedAt || new Date().toISOString()
  };
}

function setProfileMeta() {
  if (!state.profile) {
    profileMetaEl.textContent = "Signed in locally";
    return;
  }

  const emailText = state.profile.email ? ` • ${state.profile.email}` : "";
  profileMetaEl.textContent = `${state.profile.name}${emailText}`;
}

function showChatShell() {
  startScreenEl.classList.add("hidden");
  chatShellEl.classList.remove("hidden");
  chatShellEl.setAttribute("aria-hidden", "false");
}

function showStartScreen() {
  startScreenEl.classList.remove("hidden");
  chatShellEl.classList.add("hidden");
  chatShellEl.setAttribute("aria-hidden", "true");
}

function updateHeroVisibility() {
  const hasUserMessage = state.messages.some((msg) => msg.role === "user");
  heroEl.classList.toggle("hidden", hasUserMessage);
}

function createMessageElement(role, text) {
  const item = document.createElement("div");
  item.className = `msg ${role}`;
  item.textContent = text;
  return item;
}

function renderMessages() {
  chatEl.innerHTML = "";
  state.messages.forEach((msg) => {
    chatEl.appendChild(createMessageElement(msg.role, msg.content));
  });
  chatEl.scrollTop = chatEl.scrollHeight;
  updateHeroVisibility();
}

function serializeMessages(messages) {
  return messages
    .filter((msg) => msg && (msg.role === "user" || msg.role === "assistant") && typeof msg.content === "string")
    .slice(-MAX_HISTORY_MESSAGES)
    .map((msg) => ({ role: msg.role, content: msg.content }));
}

function saveState() {
  const payload = {
    selectedModel: state.selectedModel,
    messages: serializeMessages(state.messages),
    profile: state.profile,
    hasStarted: state.hasStarted
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed.messages)) {
      state.messages = serializeMessages(parsed.messages);
    }

    if (typeof parsed.selectedModel === "string" && parsed.selectedModel.trim()) {
      state.selectedModel = parsed.selectedModel;
    }

    const profile = sanitizeProfile(parsed.profile);
    if (profile) {
      state.profile = profile;
      state.hasStarted = true;
    } else {
      state.hasStarted = false;
    }
  } catch {
    setStatus("Saved chat was invalid and has been ignored.");
  }
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
  state.models = [];
  state.selectedModel = "claude-opus-4-5";
  state.messages = [];
  state.isSending = false;
  state.hasStarted = false;
  state.profile = null;
  state.pendingImage = null;
  updateAttachmentUi();
}

function extractTextFromResponse(response) {
  if (typeof response === "string") {
    return response;
  }

  if (response?.message?.content && typeof response.message.content === "string") {
    return response.message.content;
  }

  if (Array.isArray(response?.message?.content)) {
    const parts = response.message.content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        if (part?.type === "text") return part.text || "";
        return "";
      })
      .filter(Boolean);

    if (parts.length > 0) {
      return parts.join("\n");
    }
  }

  if (typeof response?.text === "string") {
    return response.text;
  }

  return String(response || "No response content returned.");
}

function updateModelSelect() {
  modelSelectEl.innerHTML = "";

  state.models.forEach((model) => {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = `${model.name || model.id} (${model.provider || "unknown"})`;
    modelSelectEl.appendChild(option);
  });

  if (state.models.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No models found";
    modelSelectEl.appendChild(option);
    modelSelectEl.disabled = true;
    return;
  }

  modelSelectEl.disabled = false;

  const hasSelected = state.models.some((model) => model.id === state.selectedModel);
  if (!hasSelected) {
    state.selectedModel = state.models[0].id;
    saveState();
  }

  modelSelectEl.value = state.selectedModel;
}

async function loadModels() {
  setStatus("Loading available models from Puter...");
  refreshModelsEl.disabled = true;

  try {
    const models = await puter.ai.listModels();
    state.models = (Array.isArray(models) ? models : [])
      .filter((model) => model && model.id)
      .sort((a, b) => a.id.localeCompare(b.id));

    updateModelSelect();
    setStatus(`Loaded ${state.models.length} models.`);
  } catch (error) {
    setStatus(`Could not load models: ${error.message}`);
  } finally {
    refreshModelsEl.disabled = false;
  }
}

function ensureInitialMessage() {
  if (state.messages.length > 0) return;

  const name = state.profile?.name || "there";
  state.messages.push({
    role: "assistant",
    content: `Welcome ${name}. Claufree is ready. Choose a model and start typing.`
  });
  saveState();
}

function buildSystemProfileMessage() {
  if (!state.profile?.consent) return null;

  const details = [`Name: ${state.profile.name}`];
  if (state.profile.email) {
    details.push(`Email: ${state.profile.email}`);
  }

  return {
    role: "system",
    content:
      "User profile shared via Claufree local sign-in:\n" +
      `${details.join("\n")}\n` +
      "Use this information only for personalization and do not expose private data."
  };
}

function buildOutboundMessages(history, userText, imagePayload) {
  const outbound = [];

  const profileSystem = buildSystemProfileMessage();
  if (profileSystem) {
    outbound.push(profileSystem);
  }

  history.slice(-MAX_HISTORY_MESSAGES).forEach((msg) => {
    outbound.push({ role: msg.role, content: msg.content });
  });

  if (imagePayload) {
    outbound.push({
      role: "user",
      content: [
        userText || "Please analyze this uploaded image.",
        {
          type: "image_url",
          image_url: { url: imagePayload.dataUrl }
        }
      ]
    });
  } else {
    outbound.push({ role: "user", content: userText });
  }

  return outbound;
}

function setComposerBusy(isBusy) {
  state.isSending = isBusy;
  sendBtn.disabled = isBusy;
  attachImageEl.disabled = isBusy;
  promptEl.disabled = isBusy;
  modelSelectEl.disabled = isBusy || state.models.length === 0;
  newChatEl.disabled = isBusy;
  railNewChatEl.disabled = isBusy;
  removeImageEl.disabled = isBusy;
}

function updateAttachmentUi() {
  if (!state.pendingImage) {
    attachmentBarEl.classList.add("hidden");
    attachmentNameEl.textContent = "";
    return;
  }

  attachmentBarEl.classList.remove("hidden");
  const kb = Math.max(1, Math.round(state.pendingImage.size / 1024));
  attachmentNameEl.textContent = `Image attached: ${state.pendingImage.name} (${kb} KB)`;
}

function clearPendingImage() {
  state.pendingImage = null;
  imageInputEl.value = "";
  updateAttachmentUi();
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

function validateImage(file) {
  if (!file) {
    return { ok: false, message: "No file selected." };
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { ok: false, message: "Only PNG, JPG, WEBP, or GIF images are allowed." };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { ok: false, message: "Image too large. Max file size is 6 MB." };
  }

  return { ok: true, message: "" };
}

async function sendMessage(userText, imagePayload) {
  setComposerBusy(true);

  const historyForApi = [...state.messages];
  const displayUserText = imagePayload
    ? `${userText || "Please analyze this uploaded image."}\n[Image: ${imagePayload.name}]`
    : userText;

  state.messages.push({ role: "user", content: displayUserText });
  renderMessages();
  saveState();

  try {
    const completion = await puter.ai.chat(
      buildOutboundMessages(historyForApi, userText, imagePayload),
      { model: state.selectedModel }
    );

    const answer = extractTextFromResponse(completion);
    state.messages.push({ role: "assistant", content: answer });
    renderMessages();
    saveState();
    setStatus(`Last response received from ${state.selectedModel}.`);
  } catch (error) {
    const message = `Error: ${error.message}`;
    state.messages.push({ role: "assistant", content: message });
    renderMessages();
    saveState();
    setStatus("Request failed. Puter authentication can still be required for some models.");
  } finally {
    setComposerBusy(false);
  }
}

function startNewChat() {
  const name = state.profile?.name || "there";
  state.messages = [
    {
      role: "assistant",
      content: `New chat started, ${name}. Ask anything.`
    }
  ];
  renderMessages();
  saveState();
  promptEl.focus();
  setStatus("Started a fresh chat.");
}

function startClaufreeSession(profile) {
  state.profile = profile;
  state.hasStarted = true;

  ensureInitialMessage();
  setProfileMeta();
  renderMessages();
  saveState();

  showChatShell();
  promptEl.focus();
  setStatus("Ready. Loading models...");
  loadModels();
}

startFormEl.addEventListener("submit", (event) => {
  event.preventDefault();

  const emailValue = profileEmailEl.value.trim();
  if (emailValue && !profileEmailEl.checkValidity()) {
    profileEmailEl.reportValidity();
    return;
  }

  const profile = sanitizeProfile({
    name: profileNameEl.value,
    email: emailValue,
    consent: profileConsentEl.checked,
    signedAt: new Date().toISOString()
  });

  if (!profile) {
    return;
  }

  startClaufreeSession(profile);
});

modelSelectEl.addEventListener("change", () => {
  state.selectedModel = modelSelectEl.value;
  saveState();
  setStatus(`Model selected: ${state.selectedModel}`);
});

refreshModelsEl.addEventListener("click", async () => {
  await loadModels();
});

newChatEl.addEventListener("click", () => {
  startNewChat();
});

railNewChatEl.addEventListener("click", () => {
  startNewChat();
});

clearLocalDataEl.addEventListener("click", () => {
  clearState();
  startFormEl.reset();
  showStartScreen();
});

attachImageEl.addEventListener("click", () => {
  imageInputEl.click();
});

imageInputEl.addEventListener("change", async () => {
  const file = imageInputEl.files && imageInputEl.files[0];
  const validation = validateImage(file);

  if (!validation.ok) {
    setStatus(validation.message);
    clearPendingImage();
    return;
  }

  try {
    const dataUrl = await readImageAsDataUrl(file);
    state.pendingImage = {
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl
    };
    updateAttachmentUi();
    setStatus(`Image ready: ${file.name}`);
  } catch (error) {
    setStatus(error.message);
    clearPendingImage();
  }
});

removeImageEl.addEventListener("click", () => {
  clearPendingImage();
  setStatus("Image removed.");
});

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.isSending) return;

  const text = promptEl.value.trim();
  if (!text && !state.pendingImage) return;

  if (text.length > MAX_MESSAGE_CHARS) {
    setStatus(`Message too long. Max ${MAX_MESSAGE_CHARS} characters.`);
    return;
  }

  const pendingImage = state.pendingImage;
  promptEl.value = "";
  clearPendingImage();

  await sendMessage(text, pendingImage);
  promptEl.focus();
});

loadState();

if (state.hasStarted && state.profile) {
  setProfileMeta();
  showChatShell();
  ensureInitialMessage();
  renderMessages();
  setStatus("Ready. Loading models...");
  loadModels();
} else {
  showStartScreen();
}
