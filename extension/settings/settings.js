"use strict";

/* HarborMarks Quick Save settings (options page).
 * Stores { harbormarksUrl, apiKey } in chrome.storage.sync. "Test
 * connection" performs a read-only GET /api/bookmarks (pageSize=1) with the
 * saved Bearer key so users can verify URL + key + CORS in one click.
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

async function load() {
  const { harbormarksUrl, apiKey } = await chrome.storage.sync.get([
    "harbormarksUrl",
    "apiKey",
  ]);
  if (harbormarksUrl) $("harbormarks-url").value = harbormarksUrl;
  if (apiKey) $("api-key").value = apiKey;
}

$("settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const baseUrl = normalizeBaseUrl($("harbormarks-url").value);
  const apiKey = $("api-key").value.trim();
  if (!baseUrl) {
    setStatus("Enter a valid http(s) HarborMarks URL.", "error");
    return;
  }
  if (!apiKey) {
    setStatus("Paste the API key from Profile → API keys.", "error");
    return;
  }
  await chrome.storage.sync.set({ harbormarksUrl: baseUrl, apiKey });
  setStatus("Settings saved.", "ok");
});

$("test").addEventListener("click", async () => {
  const baseUrl = normalizeBaseUrl($("harbormarks-url").value);
  const apiKey = $("api-key").value.trim();
  if (!baseUrl || !apiKey) {
    setStatus("Fill in the URL and key first.", "error");
    return;
  }
  setStatus("Testing…", "");
  try {
    const response = await fetch(
      `${baseUrl}/api/bookmarks?pageSize=1`,
      {
        headers: { authorization: `Bearer ${apiKey}` },
      }
    );
    if (response.status === 401) {
      setStatus("Unauthorized — the key is wrong or revoked.", "error");
      return;
    }
    if (!response.ok) {
      setStatus(`Server answered ${response.status}.`, "error");
      return;
    }
    setStatus("Connected — URL, key, and CORS all check out.", "ok");
  } catch {
    setStatus(
      "Can't reach HarborMarks. Check the URL, network, and HARBOR_CORS_ORIGINS.",
      "error"
    );
  }
});

void load();
