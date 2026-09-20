// Service worker: wires up the side panel and relays context extraction
// requests between the side panel UI and the content script on the page.
// It never touches the main chat tab's DOM itself.

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ask-side-agent-selection",
    title: 'Ask side agent about "%s"',
    contexts: ["selection"],
  });
});

// Clicking the toolbar icon opens the side panel for the current tab.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "ask-side-agent-selection" || !tab?.id) return;

  // Stash the selection for this tab so the side panel can pick it up
  // whether it's already open or about to be opened.
  await chrome.storage.session.set({
    [`pendingSelection:${tab.id}`]: info.selectionText || "",
  });

  await chrome.sidePanel.open({ tabId: tab.id });
});

// Relay: side panel asks background to extract the current conversation
// from the active tab's content script, since the side panel page itself
// has no access to the host page's DOM.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "EXTRACT_CONTEXT" && message.tabId) {
    chrome.tabs.sendMessage(
      message.tabId,
      { type: "EXTRACT_CONTEXT" },
      (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        sendResponse({ ok: true, data: response });
      }
    );
    return true; // keep the message channel open for the async response
  }
});
