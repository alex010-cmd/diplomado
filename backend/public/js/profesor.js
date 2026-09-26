'use strict';

window.ProfesorView = (function () {
  async function init(container, user) {
    container.innerHTML =
      '<h2>Mis cursos</h2>' +
      '<p class="muted">Gestiona las notas de los estudiantes inscritos en tus cursos.</p>' +
      '<div id="profesor-content"></div>';
    await loadCourses(container);
  }

  async function loadCourses(container) {
    const target = container.querySelector('#profesor-content');
    try {
      const { courses } = await API.get('/api/courses');
      if (!courses.length) {
        target.innerHTML = '<p class="empty">No tienes cursos asignados.</p>';
        return;
      }
      target.innerHTML =
        '<table class="table">' +
        '<thead><tr><th>Código</th><th>Curso</th><th>Inscritos</th><th></th></tr></thead>' +
        '<tbody>' +
        courses
          .map((c) => {
            return (
              '<tr><td>' + escapeHtml(c.codigo) + '</td>' +
              '<td>' + escapeHtml(c.nombre) + '</td>' +
              '<td>' + escapeHtml(c.inscritos) + '</td>' +
              '<td><button type="button" class="btn btn-sm" data-course-id="' +
              escapeHtml(c.id) + '">Ver estudiantes</button></td></tr>'
            );
          })
          .join('') +
        '</tbody></table>' +
        '<div id="students-panel"></div>';

      target.querySelectorAll('button[data-course-id]').forEach((btn) => {
        btn.addEventListener('click', () => showStudents(container, Number(btn.dataset.courseId)));
      });
    } catch (err) {
      target.innerHTML = '<p class="error">' + escapeHtml(err.message) + '</p>';
    }
  }

  async function showStudents(container, courseId) {
    const panel = container.querySelector('#students-panel');
    try {
      const data = await API.get('/api/courses/' + courseId + '/students');
      const course = data.course;
      const students = data.students;

      if (!students.length) {
        panel.innerHTML = '<p class="empty">El curso no tiene estudiantes inscritos.</p>';
        return;
      }

      panel.innerHTML =
        '<h3>' + escapeHtml(course.nombre) + ' (' + escapeHtml(course.codigo) + ')</h3>' +
        '<table class="table">' +
        '<thead><tr><th>Estudiante</th><th>Correo</th><th>Nota actual</th><th>Nueva nota</th><th></th></tr></thead>' +
        '<tbody>' +
        students
          .map((s) => {
            const actual = s.nota == null ? '—' : escapeHtml(s.nota);
            return (
              '<tr><td>' + escapeHtml(s.name) + '</td>' +
              '<td>' + escapeHtml(s.email) + '</td>' +
              '<td>' + actual + '</td>' +
              '<td><input type="number" min="0" max="100" step="0.5" class="grade-input" ' +
              'data-student-id="' + escapeHtml(s.id) + '" placeholder="0-100" value="' +
              (s.nota == null ? '' : escapeHtml(s.nota)) + '"></td>' +
              '<td><button type="button" class="btn btn-sm save-grade" data-course-id="' +
              escapeHtml(courseId) + '" data-student-id="' + escapeHtml(s.id) + '">Guardar</button></td></tr>'
            );
          })
          .join('') +
        '</tbody></table>';

      panel.querySelectorAll('button.save-grade').forEach((btn) => {
        btn.addEventListener('click', () => saveGrade(btn, panel));
      });
    } catch (err) {
      panel.innerHTML = '<p class="error">' + escapeHtml(err.message) + '</p>';
    }
  }

  async function saveGrade(btn, panel) {
    const cid = Number(btn.dataset.courseId);
    const sid = Number(btn.dataset.studentId);
    const input = panel.querySelector('input.grade-input[data-student-id="' + sid + '"]');
    const valor = Number(input.value);

    const gradeErr = Validators.grade(input.value);
    if (gradeErr) {
      showToast(gradeErr, 'error');
      return;
    }

    btn.disabled = true;
    try {
      await API.put('/api/grades/' + cid, { studentId: sid, valor });
      showToast('Nota guardada correctamente.', 'success');
    } catch (err) {
      showToast(err.message || 'No se pudo guardar la nota.', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  return { init };
})();
