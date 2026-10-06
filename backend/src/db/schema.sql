PRAGMA foreign_keys = ON;

-- Usuarios del sistema (roles: admin, profesor, estudiante)
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('admin', 'profesor', 'estudiante')),
  active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users (role);

-- Refresh tokens: SOLO se almacena el hash (sha-256), nunca el token en claro.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT    NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_hash ON refresh_tokens (token_hash);

-- Cursos
CREATE TABLE IF NOT EXISTS cursos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo      TEXT    NOT NULL UNIQUE,
  nombre      TEXT    NOT NULL,
  descripcion TEXT,
  profesor_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
  active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cursos_profesor ON cursos (profesor_id);

-- Inscripciones de estudiantes a cursos
CREATE TABLE IF NOT EXISTS inscripciones (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  curso_id      INTEGER NOT NULL REFERENCES cursos (id) ON DELETE CASCADE,
  estudiante_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (curso_id, estudiante_id)
);
CREATE INDEX IF NOT EXISTS idx_insc_curso      ON inscripciones (curso_id);
CREATE INDEX IF NOT EXISTS idx_insc_estudiante ON inscripciones (estudiante_id);

-- Notas (una nota por estudiante y curso)
CREATE TABLE IF NOT EXISTS notas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  curso_id      INTEGER NOT NULL REFERENCES cursos (id) ON DELETE CASCADE,
  estudiante_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  valor         REAL    NOT NULL CHECK (valor >= 0 AND valor <= 100),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (curso_id, estudiante_id)
);
CREATE INDEX IF NOT EXISTS idx_notas_curso      ON notas (curso_id);
CREATE INDEX IF NOT EXISTS idx_notas_estudiante ON notas (estudiante_id);

-- Auditoria (nunca contiene contrasenas, tokens ni datos sensibles en claro)
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  result     TEXT NOT NULL,
  ip         TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_user    ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at);
