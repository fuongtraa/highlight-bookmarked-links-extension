let activePorts = [];
let debounceTimer = null;

// 🛠 Lấy domain từ storage hoặc yêu cầu content script gửi lại
function getCurrentDomain(callback) {
  chrome.storage.session.get("currentDomain", data => {
    if (data.currentDomain) {
      console.log("[DEBUG] Loaded domain from session:", data.currentDomain);
      callback(data.currentDomain);
    } else {
      console.warn("[WARN] No domain in session. Requesting from content script...");
      requestDomainFromContentScript(callback);
    }
  });
}

// 🛠 Yêu cầu content script gửi domain nếu không tìm thấy trong session
function requestDomainFromContentScript(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs.length === 0 || !tabs[0].url || !tabs[0].url.startsWith("http")) {
      console.error("[ERROR] Unable to get valid domain from tabs.");
      return;
    }

    const url = new URL(tabs[0].url);
    const domainParts = url.hostname.split('.');
    const currentDomain = domainParts.length > 2
      ? domainParts[domainParts.length - 2]
      : domainParts[0];

    chrome.storage.session.set({ currentDomain }, () => {
      console.log("[DEBUG] Saved domain to session:", currentDomain);
      callback(currentDomain);
    });
  });
}

// 🛠 Lấy bookmark theo domain và lưu vào session storage
function fetchBookmarkedComponentsForDomain(currentDomain, callback) {
  if (!currentDomain) {
    console.error("[ERROR] Current domain is undefined.");
    return;
  }

  chrome.bookmarks.getTree(bookmarkTree => {
    if (!bookmarkTree) {
      console.error("[ERROR] Failed to load bookmark tree.");
      return;
    }

    const bookmarkedComponents = [];

    function extractComponents(node) {
      if (node.url) {
        const parsedURL = new URL(node.url);
        const domainParts = parsedURL.hostname.split('.');
        const domainName = domainParts.length > 2
          ? domainParts[domainParts.length - 2]
          : domainParts[0];

        if (domainName === currentDomain) {
          bookmarkedComponents.push({
            domain: domainName,
            path: parsedURL.pathname,
            query: parsedURL.search
          });
        }
      }
      if (node.children) node.children.forEach(extractComponents);
    }

    extractComponents(bookmarkTree[0]); // 🛠 Duyệt từ root

    if (bookmarkedComponents.length === 0) {
      console.warn(`[WARN] No bookmarks found for domain ${currentDomain}.`);
    } else {
      console.log(`[DEBUG] Found ${bookmarkedComponents.length} bookmarks for domain ${currentDomain}:`, bookmarkedComponents);
    }

    // 🛠 Lưu vào session storage
    chrome.storage.session.set({ bookmarkedComponents }, () => {
      notifyContentScripts();
      if (callback) callback(bookmarkedComponents);
    });
  });
}

// 🛠 Gửi tín hiệu cập nhật highlight đến các content script đã kết nối
function notifyContentScripts() {
  activePorts.forEach(port => {
    try {
      port.postMessage({ action: "updateHighlight" });
      console.log("[DEBUG] Sent updateHighlight to content script.");
    } catch (error) {
      console.warn("[WARN] Failed to send updateHighlight:", error);
    }
  });
}

// 🛠 Khi content script kết nối, lưu `port`
chrome.runtime.onConnect.addListener(port => {
  console.log("[DEBUG] Content script connected.");
  activePorts.push(port);
  port.onDisconnect.addListener(() => {
    activePorts = activePorts.filter(p => p !== port);
  });
});

// 🛠 Xử lý yêu cầu từ content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "sendDomain") {
    console.log("[DEBUG] Received domain from content script:", message.domain);
    chrome.storage.session.set({ currentDomain: message.domain });
    fetchBookmarkedComponentsForDomain(message.domain);
  }

  if (message.action === "getBookmarkedComponents") {
    chrome.storage.session.get("bookmarkedComponents", data => {
      if (!data.bookmarkedComponents || data.bookmarkedComponents.length === 0) {
        console.warn("[WARN] No bookmarked data found. Updating...");
        getCurrentDomain(domain => fetchBookmarkedComponentsForDomain(domain, () => {
          chrome.storage.session.get("bookmarkedComponents", updatedData => {
            sendResponse({ bookmarkedComponents: updatedData.bookmarkedComponents || [] });
          });
        }));
      } else {
        sendResponse({ bookmarkedComponents: data.bookmarkedComponents });
      }
    });

    return true; // Async response
  }
});

// 🛠 Khi bookmark thay đổi, cập nhật lại dữ liệu
function requestDomainUpdate() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    getCurrentDomain(domain => fetchBookmarkedComponentsForDomain(domain));
  }, 500);
}

// 🛠 Cập nhật khi bookmark thay đổi
chrome.bookmarks.onCreated.addListener(requestDomainUpdate);
chrome.bookmarks.onChanged.addListener(requestDomainUpdate);
chrome.bookmarks.onRemoved.addListener(requestDomainUpdate);
