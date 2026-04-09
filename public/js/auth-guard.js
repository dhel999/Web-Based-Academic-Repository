/* ============================================================
   auth-guard.js — Protect pages that require login
   Include this BEFORE page-specific JS on protected pages
   ============================================================ */
(function() {
  const token = localStorage.getItem('token');
  const user  = JSON.parse(localStorage.getItem('user') || 'null');

  if (!token || !user) {
    window.location.href = 'login.html';
    return;
  }

  // Check token expiry
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
      return;
    }
  } catch {
    window.location.href = 'login.html';
    return;
  }

  // Make auth available globally
  window.AUTH = { token, user };

  // Helper for authenticated API calls
  window.authFetch = (url, options = {}) => {
    options.headers = options.headers || {};
    options.headers['Authorization'] = `Bearer ${token}`;
    return fetch(url, options);
  };

  // Render user nav item if element exists
  const navUser = document.getElementById('navUser');
  if (navUser) {
    navUser.innerHTML = `
      <div class="nav-user-wrap">
        <span class="nav-user-name"><i class="fas fa-user-circle"></i> ${escapeHtml(user.full_name)}</span>
        <button class="btn btn-outline btn-sm" id="btnLogout" title="Logout">
          <i class="fas fa-right-from-bracket"></i>
        </button>
      </div>
    `;
    document.getElementById('btnLogout').addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
    });
  }

  // Hamburger
  const hamburger = document.getElementById('hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      document.getElementById('navLinks').classList.toggle('open');
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
})();
