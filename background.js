// background.js (Manifest V3 service worker)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getActiveTabUrl") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        sendResponse({ activeUrl: tabs[0].url });
      } else {
        sendResponse({ activeUrl: "" });
      }
    });
    // Return true to allow asynchronous sendResponse
    return true;
  }

  // Existing "navigate" handler (optional)
  if (request.action === "navigate") {
    const { url, currentTab } = request;
    if (currentTab) {
      chrome.tabs.update(sender.tab.id, { url });
    } else {
      chrome.tabs.create({ url });
    }
  }
});
