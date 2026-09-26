'use strict';

window.EstudianteView = (function () {
  async function init(container, user) {
    container.innerHTML =
      '<h2>Mis cursos y notas</h2>' +
      '<p class="muted">Solo puedes ver la información de tu propia cuenta.</p>' +
      '<div id="estudiante-content"></div>';
    await load(container);
  }

  async function load(container) {
    const target = container.querySelector('#estudiante-content');
    try {
      const { courses } = await API.get('/api/courses');
      if (!courses.length) {
        target.innerHTML = '<p class="empty">No estás inscrito en ningún curso.</p>';
        return;
      }
      target.innerHTML =
        '<table class="table">' +
        '<thead><tr><th>Código</th><th>Curso</th><th>Profesor</th><th>Nota</th></tr></thead>' +
        '<tbody>' +
        courses
          .map((c) => {
            const nota = c.nota == null ? '—' : escapeHtml(c.nota);
            return (
              '<tr><td>' + escapeHtml(c.codigo) + '</td>' +
              '<td>' + escapeHtml(c.nombre) + '</td>' +
              '<td>' + escapeHtml(c.profesor_nombre) + '</td>' +
              '<td>' + nota + '</td></tr>'
            );
          })
          .join('') +
        '</tbody></table>';
    } catch (err) {
      target.innerHTML = '<p class="error">' + escapeHtml(err.message) + '</p>';
    }
  }

  return { init };
})();
