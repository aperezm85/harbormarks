"use strict";

/* HarborMarks Quick Save service worker.
 * Adds a right-click menu entry that opens the /save quick-save page for the
 * link or tab. This path reuses the Safari login session, so it works even
 * before an API key is configured — the popup is the Bearer-key path.
 */

const MENU_ID = "harbormarks-save";

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

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Save to HarborMarks",
    contexts: ["page", "link"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const { harbormarksUrl } = await chrome.storage.sync.get("harbormarksUrl");
  const baseUrl = normalizeBaseUrl(harbormarksUrl);
  if (!baseUrl) {
    await chrome.runtime.openOptionsPage();
    return;
  }
  const pageUrl = info.linkUrl || (tab && tab.url) || "";
  if (!pageUrl || !/^https?:/.test(pageUrl)) return;
  const target =
    `${baseUrl}/save?url=${encodeURIComponent(pageUrl)}` +
    (tab && tab.title ? `&title=${encodeURIComponent(tab.title)}` : "");
  await chrome.tabs.create({ url: target });
});
