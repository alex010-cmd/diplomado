'use strict';

(async function () {
  const userName = document.getElementById('user-name');
  const userRole = document.getElementById('user-role');
  const content = document.getElementById('content');
  const logoutBtn = document.getElementById('logout-btn');

  let user;
  try {
    const data = await API.get('/api/auth/me');
    user = data.user;
  } catch (_err) {
    window.location.href = '/login.html';
    return;
  }

  userName.textContent = user.name;
  userRole.textContent = user.role;

  logoutBtn.addEventListener('click', async () => {
    try {
      await API.post('/api/auth/logout');
    } catch (_err) {
      /* ignorar */
    }
    window.location.href = '/login.html';
  });

  if (user.role === 'admin') AdminView.init(content, user);
  else if (user.role === 'profesor') ProfesorView.init(content, user);
  else EstudianteView.init(content, user);
})();
