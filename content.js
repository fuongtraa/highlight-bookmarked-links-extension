let cachedBookmarkedComponents = [];
let port = null;
let debounceTimer = null; // 🛠 Đảm bảo khai báo debounceTimer
let domainSent = false; // 🛠 Biến kiểm tra đã gửi domain chưa
let retryCount = 0; // 🛠 Giới hạn số lần thử lại khi gửi domain

// 🛠 Kết nối với background.js
function connectToBackground() {
  if (port) {
    port.disconnect();
  }

  port = chrome.runtime.connect();
  console.log("[DEBUG] Connected to background.js");

  port.onMessage.addListener(message => {
    if (message.action === "updateHighlight") {
      console.log("[DEBUG] Received updateHighlight from background.");
      syncBookmarks();
    }
  });

  port.onDisconnect.addListener(() => {
    console.log("[WARN] Port disconnected! Reconnecting in 500ms...");
    setTimeout(connectToBackground, 500); // 🛠 Tự động kết nối lại nếu bị mất kết nối
  });
}

// 🛠 Xử lý nếu trang được khôi phục từ bfcache
window.addEventListener("pageshow", event => {
  if (event.persisted) {
    console.log("[DEBUG] Page restored from bfcache, reconnecting...");
    connectToBackground();
  }
}, { once: true });

// 🛠 Gửi domain ngay khi trang tải (chỉ gửi một lần)
function sendDomainToBackground() {
  if (domainSent) {
    console.log("[DEBUG] Domain already sent. Skipping...");
    return; // 🛠 Nếu đã gửi domain thành công, không gửi lại
  }

  const url = window.location.hostname;
  const domain = url.split('.').slice(-2, -1)[0];
  console.log("[DEBUG] Sending domain to background:", domain);

  chrome.runtime.sendMessage({ action: "sendDomain", domain }, response => {
    if (chrome.runtime.lastError) {
      console.log("[WARN] Failed to send message. Retrying in 500ms...");

      if (retryCount < 5) { // 🛠 Giới hạn số lần thử lại
        retryCount++;
        setTimeout(sendDomainToBackground, 1000);
      } else {
        console.log("[ERROR] Reached max retry attempts. Stopping domain sending.");
      }

    } else {
      console.log("[DEBUG] Domain sent successfully!");
      domainSent = true; // 🛠 Đánh dấu là đã gửi domain thành công
    }
  });
}

// 🛠 Lấy bookmark từ background.js, thử lại nếu thất bại
function syncBookmarks() {
  console.log("[DEBUG] Requesting bookmarked components...");

  chrome.runtime.sendMessage({ action: "getBookmarkedComponents" }, response => {
    if (chrome.runtime.lastError) {
      console.log("[WARN] Failed to get bookmarks. Retrying in 500ms...");
      setTimeout(syncBookmarks, 500);
      return;
    }

    if (response && response.bookmarkedComponents) {
      cachedBookmarkedComponents = response.bookmarkedComponents;
      console.log("[DEBUG] Received bookmarked components:", cachedBookmarkedComponents);
      initializeHighlighting();
    } else {
      console.log("[ERROR] Failed to receive bookmarked components.");
      sendDomainToBackground();
      setTimeout(syncBookmarks, 500);
    }
  });
}

// 🛠 Chuẩn hóa URL trước khi so sánh
function normalizeURL(url) {
  try {
    const parsedURL = new URL(url);
    let domainParts = parsedURL.hostname.replace(/^www\./, '').split('.');
    const domainName = domainParts.length > 2 ? domainParts[domainParts.length - 2] : domainParts[0];

    return `${domainName}${parsedURL.pathname}${parsedURL.search}`;
  } catch (e) {
    return null;
  }
}

// 🛠 Highlight các liên kết đã bookmark
function initializeHighlighting() {
  if (!cachedBookmarkedComponents.length) {
    console.log("[WARN] No bookmarked components found. Skipping highlighting.");
    return;
  }

  const bookmarkSet = new Set(
    cachedBookmarkedComponents.map(comp => `${comp.domain}${comp.path}${comp.query}`)
  );

  console.log("[DEBUG] Created bookmarkSet with", bookmarkSet.size, "entries");

  const linkObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const link = entry.target;
      if (entry.isIntersecting) {
        const linkKey = normalizeURL(link.href);
        if (linkKey && bookmarkSet.has(linkKey)) {
          console.log("[DEBUG] Match found! Highlighting:", link.href);
          highlightLink(link);
        }
      }
    });
  });

  document.querySelectorAll('a').forEach(link => linkObserver.observe(link));
}

// 🛠 Highlight link
function highlightLink(link) {
  link.style.color = "cyan";
  link.style.fontStyle = "italic";
  link.style.backgroundColor = "rgba(0, 255, 255, 0.2)";
  link.style.borderRadius = "4px";
  link.style.padding = "2px";

  link.querySelectorAll('*').forEach(child => {
    child.style.color = "cyan";
  });
}

// 🛠 Theo dõi thay đổi DOM để cập nhật highlight khi có liên kết mới
function setupMutationObserver() {
  if (!document.body) {
    console.log("[WARN] document.body is not ready. Retrying in 500ms...");
    setTimeout(setupMutationObserver, 500);
    return;
  }

  const mutationObserver = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      initializeHighlighting();
    }, 100);
  });

  mutationObserver.observe(document.body, { childList: true, subtree: true });
  console.log("[DEBUG] MutationObserver started.");
}

// 🛠 Chạy ngay khi trang tải
document.addEventListener("DOMContentLoaded", () => {
  console.log("[DEBUG] DOMContentLoaded event fired.");
  connectToBackground();
  sendDomainToBackground();
  syncBookmarks();
  setupMutationObserver();
});
