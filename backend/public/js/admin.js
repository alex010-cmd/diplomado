'use strict';

window.AdminView = (function () {
  function init(container, user) {
    container.innerHTML =
      '<h2>Panel de administración</h2>' +
      '<div class="tabs">' +
      '<button type="button" data-tab="usuarios" class="tab active">Usuarios</button>' +
      '<button type="button" data-tab="cursos" class="tab">Cursos e inscripciones</button>' +
      '<button type="button" data-tab="auditoria" class="tab">Auditoría</button>' +
      '</div>' +
      '<div id="tab-content"></div>';

    container.querySelectorAll('.tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        showTab(container, btn.dataset.tab);
      });
    });

    showTab(container, 'usuarios');
  }

  function showTab(container, tab) {
    if (tab === 'usuarios') return renderUsuarios(container);
    if (tab === 'cursos') return renderCursos(container);
    return renderAuditoria(container);
  }

  /* ---------------- Usuarios ---------------- */

  async function renderUsuarios(container) {
    const target = container.querySelector('#tab-content');
    target.innerHTML =
      '<section class="card"><h3>Buscar usuarios</h3>' +
      '<form id="search-form"><input type="text" id="search-input" placeholder="Nombre o correo" maxlength="100">' +
      '<button type="submit" class="btn">Buscar</button></form></section>' +
      '<section class="card"><h3>Crear usuario</h3>' +
      '<form id="create-user-form">' +
      '<input type="text" id="nu-name" placeholder="Nombre completo" required>' +
      '<input type="email" id="nu-email" placeholder="correo@universidad.edu" required>' +
      '<input type="password" id="nu-password" placeholder="Contraseña segura" required>' +
      '<select id="nu-role"><option value="estudiante">estudiante</option>' +
      '<option value="profesor">profesor</option><option value="admin">admin</option></select>' +
      '<button type="submit" class="btn btn-primary">Crear</button></form></section>' +
      '<section class="card"><h3>Listado</h3><div id="users-table"></div></section>';

    const { rows } = await API.get('/api/users');
    paintUsers(target, rows);

    target.querySelector('#search-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const q = target.querySelector('#search-input').value.trim();
      const url = q ? '/api/users?search=' + encodeURIComponent(q) : '/api/users';
      const data = await API.get(url);
      paintUsers(target, data.rows);
    });

    target.querySelector('#create-user-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = target.querySelector('#nu-name').value.trim();
      const email = target.querySelector('#nu-email').value.trim();
      const password = target.querySelector('#nu-password').value;
      const role = target.querySelector('#nu-role').value;

      const nameErr = Validators.name(name);
      if (nameErr) return showToast(nameErr, 'error');
      const emailErr = Validators.email(email);
      if (emailErr) return showToast(emailErr, 'error');
      const passErr = Validators.password(password);
      if (passErr) return showToast(passErr, 'error');

      try {
        await API.post('/api/users', { name, email, password, role });
        showToast('Usuario creado.', 'success');
        const data = await API.get('/api/users');
        paintUsers(target, data.rows);
        e.target.reset();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  function paintUsers(target, users) {
    const div = target.querySelector('#users-table');
    if (!users.length) {
      div.innerHTML = '<p class="empty">Sin resultados.</p>';
      return;
    }
    div.innerHTML =
      '<table class="table"><thead><tr><th>ID</th><th>Nombre</th><th>Correo</th>' +
      '<th>Rol</th><th>Activo</th><th>Acciones</th></tr></thead><tbody>' +
      users
        .map((u) => {
          return (
            '<tr><td>' + escapeHtml(u.id) + '</td>' +
            '<td>' + escapeHtml(u.name) + '</td>' +
            '<td>' + escapeHtml(u.email) + '</td>' +
            '<td><select class="role-select" data-user-id="' + escapeHtml(u.id) + '">' +
            ['admin', 'profesor', 'estudiante']
              .map(
                (r) =>
                  '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + r + '</option>'
              )
              .join('') +
            '</select></td>' +
            '<td><input type="checkbox" class="active-check" data-user-id="' +
            escapeHtml(u.id) + '"' + (u.active ? ' checked' : '') + '></td>' +
            '<td><button type="button" class="btn btn-sm apply-user" data-user-id="' +
            escapeHtml(u.id) + '">Aplicar</button></td></tr>'
          );
        })
        .join('') +
      '</tbody></table>';

    div.querySelectorAll('button.apply-user').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.userId);
        const row = btn.closest('tr');
        const role = row.querySelector('.role-select').value;
        const active = row.querySelector('.active-check').checked;
        btn.disabled = true;
        try {
          await API.patch('/api/users/' + id, { role, active });
          showToast('Usuario ' + id + ' actualizado.', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  /* ---------------- Cursos e inscripciones ---------------- */

  async function renderCursos(container) {
    const target = container.querySelector('#tab-content');
    target.innerHTML =
      '<section class="card"><h3>Crear curso</h3>' +
      '<form id="create-course-form">' +
      '<input type="text" id="nc-codigo" placeholder="Código (ej. CS-103)" maxlength="20" required>' +
      '<input type="text" id="nc-nombre" placeholder="Nombre del curso" maxlength="120" required>' +
      '<input type="text" id="nc-desc" placeholder="Descripción (opcional)" maxlength="500">' +
      '<select id="nc-profesor"><option value="">Sin profesor asignado</option></select>' +
      '<button type="submit" class="btn btn-primary">Crear curso</button></form></section>' +
      '<section class="card"><h3>Inscribir estudiante</h3>' +
      '<form id="enroll-form">' +
      '<select id="en-curso"></select>' +
      '<select id="en-estudiante"></select>' +
      '<button type="submit" class="btn">Inscribir</button></form></section>' +
      '<section class="card"><h3>Listado de cursos</h3><div id="courses-table"></div></section>';

    const [{ courses }, { rows: users }] = await Promise.all([
      API.get('/api/courses'),
      API.get('/api/users'),
    ]);

    const professors = users.filter((u) => u.role === 'profesor' && u.active);
    const students = users.filter((u) => u.role === 'estudiante' && u.active);

    const profSelect = target.querySelector('#nc-profesor');
    professors.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = String(p.id);
      opt.textContent = p.name + ' (' + p.email + ')';
      profSelect.appendChild(opt);
    });

    const courseSelect = target.querySelector('#en-curso');
    courses.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = String(c.id);
      opt.textContent = c.codigo + ' - ' + c.nombre;
      courseSelect.appendChild(opt);
    });

    const studentSelect = target.querySelector('#en-estudiante');
    students.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = String(s.id);
      opt.textContent = s.name + ' (' + s.email + ')';
      studentSelect.appendChild(opt);
    });

    paintCourses(target, courses);

    target.querySelector('#create-course-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const codigo = target.querySelector('#nc-codigo').value.trim();
      const nombre = target.querySelector('#nc-nombre').value.trim();
      const descripcion = target.querySelector('#nc-desc').value.trim();
      const profesorId = target.querySelector('#nc-profesor').value;
      try {
        await API.post('/api/courses', {
          codigo,
          nombre,
          descripcion: descripcion || undefined,
          profesorId: profesorId ? Number(profesorId) : undefined,
        });
        showToast('Curso creado.', 'success');
        e.target.reset();
        const data = await API.get('/api/courses');
        paintCourses(target, data.courses);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    target.querySelector('#enroll-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const cursoId = Number(target.querySelector('#en-curso').value);
      const studentId = Number(target.querySelector('#en-estudiante').value);
      if (!cursoId || !studentId) return showToast('Selecciona curso y estudiante.', 'error');
      try {
        await API.post('/api/courses/' + cursoId + '/enroll', { studentId });
        showToast('Estudiante inscrito.', 'success');
        const data = await API.get('/api/courses');
        paintCourses(target, data.courses);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  function paintCourses(target, courses) {
    const div = target.querySelector('#courses-table');
    if (!courses.length) {
      div.innerHTML = '<p class="empty">No hay cursos.</p>';
      return;
    }
    div.innerHTML =
      '<table class="table"><thead><tr><th>Código</th><th>Nombre</th>' +
      '<th>Profesor</th><th>Inscritos</th><th>Estado</th></tr></thead><tbody>' +
      courses
        .map((c) => {
          return (
            '<tr><td>' + escapeHtml(c.codigo) + '</td>' +
            '<td>' + escapeHtml(c.nombre) + '</td>' +
            '<td>' + escapeHtml(c.profesor_nombre || '—') + '</td>' +
            '<td>' + escapeHtml(c.inscritos) + '</td>' +
            '<td>' + (c.active ? 'Activo' : 'Inactivo') + '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table>';
  }

  /* ---------------- Auditoría ---------------- */

  async function renderAuditoria(container) {
    const target = container.querySelector('#tab-content');
    target.innerHTML =
      '<section class="card"><h3>Eventos de auditoría</h3>' +
      '<p class="muted">Se registran inicios de sesión, accesos denegados, cambios de datos sensibles y operaciones de administración. Nunca se guardan contraseñas ni tokens.</p>' +
      '<div id="audit-table"></div></section>';

    const div = target.querySelector('#audit-table');
    try {
      const data = await API.get('/api/audit?limit=200');
      if (!data.rows.length) {
        div.innerHTML = '<p class="empty">Sin eventos registrados.</p>';
        return;
      }
      div.innerHTML =
        '<table class="table"><thead><tr><th>ID</th><th>Fecha</th><th>Usuario</th>' +
        '<th>Acción</th><th>Entidad</th><th>Resultado</th><th>IP</th></tr></thead><tbody>' +
        data.rows
          .map((a) => {
            return (
              '<tr><td>' + escapeHtml(a.id) + '</td>' +
              '<td>' + escapeHtml(a.created_at) + '</td>' +
              '<td>' + escapeHtml(a.user_email || '—') + '</td>' +
              '<td>' + escapeHtml(a.action) + '</td>' +
              '<td>' + escapeHtml(a.entity || '—') +
              (a.entity_id ? ' #' + escapeHtml(a.entity_id) : '') + '</td>' +
              '<td><span class="result-' + escapeHtml(a.result) + '">' +
              escapeHtml(a.result) + '</span></td>' +
              '<td>' + escapeHtml(a.ip || '—') + '</td></tr>'
            );
          })
          .join('') +
        '</tbody></table>';
    } catch (err) {
      div.innerHTML = '<p class="error">' + escapeHtml(err.message) + '</p>';
    }
  }

  return { init };
})();
