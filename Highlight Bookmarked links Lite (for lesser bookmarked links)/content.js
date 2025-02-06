// Highlight các liên kết khớp với bookmark
function highlightLinks(bookmarkedComponents) {
  const bookmarkSet = new Set(
    bookmarkedComponents.map(comp => `${comp.domain}${comp.path}${comp.query}`)
  );

  const links = document.querySelectorAll('a');
  links.forEach(link => {
    const linkComponents = extractURLComponents(link.href);
    if (!linkComponents) return;

    const linkKey = `${linkComponents.domain}${linkComponents.path}${linkComponents.query}`;
    if (bookmarkSet.has(linkKey)) {
      link.style.setProperty('color', 'cyan', 'important');
      link.style.setProperty('font-style', 'italic', 'important');
      //link.style.setProperty('font-weight', 'bold', 'important');
      link.style.setProperty('text-decoration', 'underline', 'important');
      link.style.setProperty('font-family', 'Limelight', 'important');
      link.querySelectorAll('*').forEach(child => {
        child.style.setProperty('color', 'cyan', 'important');
        child.style.setProperty('text-decoration', 'underline', 'important');
        child.style.setProperty('font-family', 'Limelight', 'important');
      });
    }
  });
}

// Đồng bộ bookmark từ background hoặc storage
function syncBookmarks() {
  chrome.runtime.sendMessage({ action: "getBookmarkedComponents" }, response => {
    if (response && response.bookmarkedComponents) {
      highlightLinks(response.bookmarkedComponents);
    }
  });
}

// Theo dõi DOM thay đổi và áp dụng highlight
const observer = new MutationObserver(mutations => {
  const hasRelevantChanges = mutations.some(mutation =>
    Array.from(mutation.addedNodes).some(node => node.tagName === 'A')
  );
  if (hasRelevantChanges) {
    syncBookmarks();
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Lần đầu tiên chạy khi load trang
syncBookmarks();

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
