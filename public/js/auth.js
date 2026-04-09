/* ============================================================
   auth.js — Login / Register page logic
   ============================================================ */
const API = '/api';

// If already logged in, redirect
const existingToken = localStorage.getItem('token');
if (existingToken) {
  try {
    const payload = JSON.parse(atob(existingToken.split('.')[1]));
    if (payload.exp * 1000 > Date.now()) {
      window.location.href = payload.role === 'admin' ? 'admin.html' : 'my-documents.html';
    }
  } catch { /* invalid token, continue to login */ }
}

// Tab switching
const tabLogin    = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginForm   = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('active');
  tabRegister.classList.remove('active');
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
});

tabRegister.addEventListener('click', () => {
  tabRegister.classList.add('active');
  tabLogin.classList.remove('active');
  registerForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
});

// Toggle password visibility
document.querySelectorAll('.toggle-pw').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const icon  = btn.querySelector('i');
    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'fas fa-eye-slash';
    } else {
      input.type = 'password';
      icon.className = 'fas fa-eye';
    }
  });
});

// LOGIN
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const loginError = document.getElementById('loginError');
  const btn = document.getElementById('btnLogin');
  loginError.classList.add('hidden');

  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in…';

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    // Redirect based on role
    window.location.href = data.user.role === 'admin' ? 'admin.html' : 'my-documents.html';
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-right-to-bracket"></i> Sign In';
  }
});

// REGISTER
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const registerError = document.getElementById('registerError');
  const btn = document.getElementById('btnRegister');
  registerError.classList.add('hidden');

  const full_name = document.getElementById('regName').value.trim();
  const email     = document.getElementById('regEmail').value.trim();
  const password  = document.getElementById('regPassword').value;
  const confirm   = document.getElementById('regConfirm').value;

  if (password !== confirm) {
    registerError.textContent = 'Passwords do not match';
    registerError.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account…';

  try {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name, email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    window.location.href = 'my-documents.html';
  } catch (err) {
    registerError.textContent = err.message;
    registerError.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
  }
});
