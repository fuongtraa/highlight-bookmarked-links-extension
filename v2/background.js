// Trích xuất domain, path, và query từ URL
function extractURLComponents(url) {
  try {
    const parsedURL = new URL(url);
    const domainParts = parsedURL.hostname.split('.');
    const domainName = domainParts.length > 2
      ? domainParts[domainParts.length - 2]
      : domainParts[0];
    return {
      domain: domainName,
      path: parsedURL.pathname,
      query: parsedURL.search
    };
  } catch (e) {
    return null;
  }
}

// Lấy danh sách URL từ bookmark và lưu vào storage
function fetchBookmarkedComponents(callback) {
  chrome.bookmarks.getTree(bookmarkTree => {
    const bookmarkedComponents = [];

    function extractComponents(node) {
      if (node.url) {
        const components = extractURLComponents(node.url);
        if (components) {
          bookmarkedComponents.push(components);
        }
      }
      if (node.children) {
        node.children.forEach(extractComponents);
      }
    }

    bookmarkTree.forEach(extractComponents);
    chrome.storage.local.set({ bookmarkedComponents }, () => {
      console.log("Updated bookmarked components:", bookmarkedComponents);
      if (callback) callback(bookmarkedComponents);
    });
  });
}

// Khi extension được cài đặt hoặc kích hoạt
chrome.runtime.onInstalled.addListener(() => {
  fetchBookmarkedComponents();
});

// Cập nhật bookmark khi có thay đổi
chrome.bookmarks.onCreated.addListener(() => fetchBookmarkedComponents());
chrome.bookmarks.onChanged.addListener(() => fetchBookmarkedComponents());
chrome.bookmarks.onRemoved.addListener(() => fetchBookmarkedComponents());

// Nhận yêu cầu lấy bookmark từ content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getBookmarkedComponents") {
    chrome.storage.local.get("bookmarkedComponents", data => {
      sendResponse({ bookmarkedComponents: data.bookmarkedComponents || [] });
    });
    return true; // Indicate async response
  }
});
