// background.js (Manifest V3 service worker)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getActiveTabUrl") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      try {
        if (chrome.runtime.lastError) {
          sendResponse({ activeUrl: "" });
          return;
        }
        if (tabs && tabs[0]) {
          sendResponse({ activeUrl: tabs[0].url });
        } else {
          sendResponse({ activeUrl: "" });
        }
      } catch (err) {
        sendResponse({ activeUrl: "" });
      }
    });
    // Return true to allow asynchronous sendResponse
    return true;
  }

  if (request.action === "openIncognito") {
    chrome.windows.create({ url: request.url, incognito: true }, function() {
      if (chrome.runtime.lastError) {
        // Most common cause: user hasn't enabled 'Allow in incognito' on this extension's
        // chrome://extensions card. Fall back to a normal new tab so the click isn't silently
        // lost, and notify the originating tab so it can show an in-page toast.
        chrome.tabs.create({ url: request.url });
        if (sender && sender.tab && typeof sender.tab.id === 'number') {
          chrome.tabs.sendMessage(sender.tab.id, { action: "incognitoFallback" }, function() {
            void chrome.runtime.lastError; // swallow 'no receiving end' if the tab navigated away
          });
        }
      }
    });
    return;
  }

  if (request.action === "navigate") {
    const { url, currentTab } = request;
    if (currentTab) {
      chrome.tabs.update(sender.tab.id, { url });
    } else {
      chrome.tabs.create({ url });
    }
  }
});
