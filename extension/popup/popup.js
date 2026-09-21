"use strict";

/* HarborMarks Quick Save popup.
 * Reads { harbormarksUrl, apiKey } from chrome.storage.sync, prefills the
 * form from the active tab, and POSTs to /api/bookmarks with Bearer auth.
 * No build step — plain MV3-safe JavaScript (no modules, no remote code).
 */

const $ = (id) => document.getElementById(id);

function normalizeBaseUrl(raw) {
  const trimmed = (raw || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function setStatus(message, tone) {
  const el = $("status");
  el.textContent = message;
  el.dataset.tone = tone || "";
}

async function getConfig() {
  const { harbormarksUrl, apiKey } = await chrome.storage.sync.get([
    "harbormarksUrl",
    "apiKey",
  ]);
  return {
    baseUrl: normalizeBaseUrl(harbormarksUrl),
    apiKey: (apiKey || "").trim(),
  };
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function readPageDescription(tabId) {
  // Best-effort: pull <meta name="description"> / og:description from the
  // page. Falls back to "" on chrome://, Web Store, or denied pages.
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const meta =
          document.querySelector('meta[property="og:description"]') ||
          document.querySelector('meta[name="description"]');
        return (meta && meta.content ? meta.content : "").trim().slice(0, 2000);
      },
    });
    return (result && result.result) || "";
  } catch {
    return "";
  }
}

async function init() {
  const { baseUrl, apiKey } = await getConfig();
  const tab = await getActiveTab();
  const pageUrl = (tab && tab.url) || "";

  $("page-url").textContent = pageUrl || "No active page found.";
  if (tab && tab.title) $("title").value = tab.title;

  if (!baseUrl || !apiKey) {
    $("needs-setup").hidden = false;
    $("save").disabled = true;
    setStatus(
      !baseUrl ? "Set your instance URL first." : "Add your API key first.",
      "info"
    );
    return;
  }

  if (tab && tab.id != null && /^https?:/.test(pageUrl)) {
    const description = await readPageDescription(tab.id);
    if (description) {
      // Stash for the save payload; the popup stays compact on purpose.
      init.pageDescription = description;
    }
  }

  $("save-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void handleSave(baseUrl, apiKey, pageUrl);
  });
}

async function handleSave(baseUrl, apiKey, pageUrl) {
  const saveButton = $("save");
  if (saveButton.disabled) return;
  if (!pageUrl || !/^https?:/.test(pageUrl)) {
    setStatus("This page can't be saved (only http(s) URLs).", "error");
    return;
  }
  saveButton.disabled = true;
  setStatus("Saving…", "info");
  try {
    const response = await fetch(`${baseUrl}/api/bookmarks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: pageUrl,
        title: $("title").value.trim() || pageUrl,
        description: init.pageDescription || "",
        tags: $("tags")
          .value.split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        isFavorite: $("favorite").checked,
        status: "unread",
        note: $("note").value.trim() ? $("note").value.trim() : null,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (
      response.status === 409 &&
      payload &&
      payload.code === "duplicate_bookmark"
    ) {
      const existing = (payload.existing && payload.existing.title) || pageUrl;
      setStatus(`Already saved: ${existing}`, "info");
      return;
    }
    if (!response.ok || !payload || !payload.data) {
      throw new Error(
        (payload && payload.error) || `Save failed (${response.status}).`
      );
    }
    setStatus(`Saved: ${payload.data.title || pageUrl}`, "ok");
  } catch (error) {
    if (error instanceof TypeError) {
      // Network failure: wrong instance URL, offline host, or CORS origin
      // (chrome-extension://…) not in HARBOR_CORS_ORIGINS server-side.
      setStatus(
        "Can't reach HarborMarks. Check the URL, CORS origins, and network.",
        "error"
      );
    } else {
      setStatus(
        error instanceof Error ? error.message : "Unable to save bookmark.",
        "error"
      );
    }
  } finally {
    saveButton.disabled = false;
  }
}

$("open-settings").addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});
$("open-settings-missing").addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});
$("open-quicksave").addEventListener("click", async () => {
  const { baseUrl } = await getConfig();
  const tab = await getActiveTab();
  if (!baseUrl || !tab || !tab.url) return;
  const target =
    `${baseUrl}/save?url=${encodeURIComponent(tab.url)}` +
    (tab.title ? `&title=${encodeURIComponent(tab.title)}` : "");
  await chrome.tabs.create({ url: target });
});

void init();
