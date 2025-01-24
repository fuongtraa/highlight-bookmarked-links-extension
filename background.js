// Lấy danh sách URL từ bookmark
function fetchBookmarkedURLs() {
  chrome.bookmarks.getTree(bookmarkTree => {
    let bookmarkedURLs = [];

    // Duyệt qua toàn bộ bookmark tree và chỉ lấy URL
    function extractURLs(node) {
      if (node.url) {
        bookmarkedURLs.push(node.url);
      }
      if (node.children) {
        node.children.forEach(extractURLs);
      }
    }

    bookmarkTree.forEach(extractURLs);

    // Lưu danh sách URL vào storage
    chrome.storage.local.set({ bookmarkedURLs }, () => {
      console.log("Bookmarked URLs saved:", bookmarkedURLs);

      // Gửi thông báo đến tất cả content scripts
				chrome.tabs.query({}, tabs => {
				tabs.forEach(tab => {
				chrome.tabs.sendMessage(tab.id, { type: "BOOKMARKS_UPDATED" }, response => {
			  if (chrome.runtime.lastError) {
				console.warn(`Error sending message to tab ${tab.id}:`, chrome.runtime.lastError.message);
			  }
			});
        });
      });
    });
  });
}

// Khi extension được cài đặt hoặc kích hoạt
chrome.runtime.onInstalled.addListener(fetchBookmarkedURLs);

// Cập nhật URL khi có thay đổi trong bookmark
chrome.bookmarks.onChanged.addListener(fetchBookmarkedURLs);
chrome.bookmarks.onCreated.addListener(fetchBookmarkedURLs);
chrome.bookmarks.onRemoved.addListener(fetchBookmarkedURLs);
