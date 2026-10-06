'use strict';

(function () {
  const form = document.getElementById('register-form');
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirm');
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

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirm = confirmInput.value;

    const nameErr = Validators.name(name);
    if (nameErr) return showError(nameErr);

    const emailErr = Validators.email(email);
    if (emailErr) return showError(emailErr);

    const passErr = Validators.password(password);
    if (passErr) return showError(passErr);

    if (password !== confirm) return showError('Las contraseñas no coinciden.');

    submitBtn.disabled = true;
    try {
      await API.post('/api/auth/register', { name, email, password });
      window.location.href = '/login.html';
    } catch (err) {
      showError(err.message || 'No se pudo completar el registro.');
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
