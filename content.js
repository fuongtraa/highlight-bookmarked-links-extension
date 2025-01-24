// Trích xuất domain-name (không bao gồm TLD), path, và query từ URL
function extractURLComponents(url) {
  try {
    const parsedURL = new URL(url);

    // Tách domain-name (loại bỏ TLD)
    const domainParts = parsedURL.hostname.split('.');
    const domainName = domainParts.length > 2
      ? domainParts[domainParts.length - 2] // Nếu là subdomain, lấy phần trước TLD
      : domainParts[0]; // Nếu chỉ có domain + TLD, lấy domain

    return {
      domain: domainName,
      path: parsedURL.pathname,
      query: parsedURL.search
    };
  } catch (e) {
    return null; // Trả về null nếu URL không hợp lệ
  }
}

// Highlight liên kết và các thẻ con
function highlightLink(link) {
  link.style.color = 'cyan';
  
  link.style.fontStyle = 'italic'; // Làm in nghiêng
  link.querySelectorAll('*').forEach(child => {
    child.style.color = 'cyan';
  });
}

// Kiểm tra và highlight các liên kết khớp với bookmark
function highlightBookmarkedLinks(bookmarkedURLs) {
  const links = document.querySelectorAll('a'); // Lấy tất cả thẻ <a> trên trang

  links.forEach(link => {
    const linkComponents = extractURLComponents(link.href);
    if (!linkComponents) return; // Bỏ qua nếu URL không hợp lệ

    // Kiểm tra khớp với bất kỳ URL đã bookmark nào
    const isMatched = bookmarkedURLs.some(bookmarkURL => {
      const bookmarkComponents = extractURLComponents(bookmarkURL);
      if (!bookmarkComponents) return false;

      // So sánh từng thành phần: domain, path, và query
      return (
        linkComponents.domain === bookmarkComponents.domain &&
        linkComponents.path === bookmarkComponents.path &&
        linkComponents.query === bookmarkComponents.query
      );
    });

    if (isMatched) {
      highlightLink(link); // Highlight nếu khớp
    }
  });
}

// Hàm lấy dữ liệu và highlight
function updateHighlights() {
  chrome.storage.local.get('bookmarkedURLs', data => {
    const bookmarkedURLs = data.bookmarkedURLs || [];
    if (bookmarkedURLs.length > 0) {
      highlightBookmarkedLinks(bookmarkedURLs);
    } else {
      console.log("No bookmarked URLs found.");
    }
  });
}

// Nhận thông báo từ background script và cập nhật highlight
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "BOOKMARKS_UPDATED") {
    console.log("Bookmarks updated. Updating highlights...");
    updateHighlights();
  }
});

// Lần đầu tiên chạy khi load trang
updateHighlights();


// Theo dõi DOM thay đổi và áp dụng highlight
const observer = new MutationObserver(() => {
  updateHighlights();
});

observer.observe(document.body, { childList: true, subtree: true });
