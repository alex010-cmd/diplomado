'use strict';

(function () {
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const errorEl = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function clearError() {
    errorEl.hidden = true;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    const emailErr = Validators.email(email);
    if (emailErr) return showError(emailErr);
    if (!password) return showError('La contraseña es obligatoria.');

    submitBtn.disabled = true;
    try {
      await API.post('/api/auth/login', { email, password });
      window.location.href = '/';
    } catch (err) {
      // El servidor devuelve SIEMPRE un mensaje generico ("Credenciales invalidas").
      showError(err.message || 'Credenciales inválidas');
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
