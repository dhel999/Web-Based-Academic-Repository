/* ============================================================
   nav-auth.js — Optional auth-aware navbar for public pages
   Shows login link when logged out, user menu when logged in.
   Include on public pages (index, dashboard, result).
   ============================================================ */
(function() {
  const token = localStorage.getItem('token');
  const user  = JSON.parse(localStorage.getItem('user') || 'null');

  const container = document.getElementById('navAuthLinks');
  if (!container) return;

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  if (token && user) {
    // Check expiry
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        renderLoggedOut();
        return;
      }
    } catch { renderLoggedOut(); return; }

    let links = '';
    links += '<li><a href="quick-scan.html"><i class="fas fa-bolt"></i> Quick Scan</a></li>';
    if (user.role === 'admin') {
      links += '<li><a href="admin.html"><i class="fas fa-shield-halved"></i> Admin</a></li>';
    } else {
      links += '<li><a href="my-documents.html"><i class="fas fa-folder-open"></i> My Documents</a></li>';
      links += '<li><a href="upload.html"><i class="fas fa-upload"></i> Upload</a></li>';
    }
    links += `<li class="nav-user-wrap">
      <span class="nav-user-name"><i class="fas fa-user-circle"></i> ${escapeHtml(user.full_name)}</span>
      <button class="btn btn-outline btn-sm" id="btnLogoutNav" title="Logout">
        <i class="fas fa-right-from-bracket"></i>
      </button>
    </li>`;
    container.outerHTML = links;

    const logoutBtn = document.getElementById('btnLogoutNav');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (!confirm('Are you sure you want to logout?')) return;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
      });
    }
  } else {
    renderLoggedOut();
  }

  function renderLoggedOut() {
    container.innerHTML = '<li><a href="quick-scan.html"><i class="fas fa-bolt"></i> Quick Scan</a></li><li><a href="login.html"><i class="fas fa-right-to-bracket"></i> Login</a></li>';
  }

  // Hamburger toggle
  const hamburger = document.getElementById('hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      document.getElementById('navLinks').classList.toggle('open');
    });
  }
})();
