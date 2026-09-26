'use strict';

// [E5.2: verificación] Suite de smoke tests (node:test + supertest).
// Prueba ejecutable de los mecanismos de seguridad para la demo en vivo.
// Verifica los mecanismos de seguridad clave:
//  1. Login correcto (sin exponer password_hash, cookie httpOnly).
//  2. Mensaje generico ante credenciales invalidas (anti-enumeracion).
//  3. Bloqueo anti-IDOR (403 al intentar leer/escribir datos ajenos).
//  4. La validacion rechaza contrasenas debiles.
//  5. Rate limit en login (429 tras 5 intentos/min).

process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.COOKIE_SECURE = 'false';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-suficientemente-largo-12345';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-suficientemente-largo-12345';

const os = require('os');
const path = require('path');
const fs = require('fs');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.DATABASE_PATH = path.join(os.tmpdir(), `portal-smoke-${Date.now()}.db`);

const { createApp } = require('../src/app');
const { runSeed } = require('../src/db/seed');

const ADMIN = { email: 'admin@universidad.edu', password: 'Admin123' };
const PROF_GARCIA = { email: 'prof.garcia@universidad.edu', password: 'Profesor123' };
const PROF_LOPEZ = { email: 'prof.lopez@universidad.edu', password: 'Profesor123' };
const ANA = { email: 'ana@universidad.edu', password: 'Estudiante123' };

async function loginAgent(app, creds) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send(creds);
  assert.equal(res.status, 200, `login fallo para ${creds.email}: ${JSON.stringify(res.body)}`);
  return agent;
}

before(() => {
  runSeed();
});

after(() => {
  try {
    fs.unlinkSync(process.env.DATABASE_PATH);
  } catch (_e) {
    /* mejor esfuerzo */
  }
});

describe('autenticacion', () => {
  const app = createApp();

  it('login correcto devuelve usuario sin password_hash y cookie httpOnly', async () => {
    const res = await request(app).post('/api/auth/login').send(ADMIN);
    assert.equal(res.status, 200);
    assert.ok(res.body.user);
    assert.equal(res.body.user.email, ADMIN.email);
    assert.equal(res.body.user.role, 'admin');
    assert.ok(!('password_hash' in res.body.user), 'no debe exponer password_hash');

    const cookies = res.headers['set-cookie'] || [];
    const access = cookies.find((c) => c.startsWith('access_token='));
    assert.ok(access, 'debe fijar cookie access_token');
    assert.match(access, /HttpOnly/i);
    assert.match(access, /SameSite=Strict/i);
  });

  it('mensaje generico ante credenciales invalidas (sin enumeracion)', async () => {
    const wrongPass = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN.email, password: 'ClaveIncorrecta1' });
    assert.equal(wrongPass.status, 401);
    assert.equal(wrongPass.body.error, 'Credenciales invalidas');

    const unknownUser = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nadie@universidad.edu', password: 'ClaveIncorrecta1' });
    assert.equal(unknownUser.status, 401);
    // Mismo mensaje indistinguible: no revela si el usuario existe.
    assert.equal(unknownUser.body.error, wrongPass.body.error);
  });

  it('GET /api/auth/me devuelve la sesion actual (regresion)', async () => {
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send(ADMIN);
    assert.equal(login.status, 200);
    const me = await agent.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, ADMIN.email);
    assert.equal(me.body.user.role, 'admin');
    assert.ok(!('password_hash' in me.body.user), 'no debe exponer password_hash');
  });

  it('endpoints protegidos exigen autenticacion (401)', async () => {
    const res = await request(app).get('/api/grades');
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'No autorizado');
  });

  it('rutas inexistentes devuelven 404 JSON', async () => {
    const res = await request(app).get('/api/noexiste');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Recurso no encontrado');
  });
});

describe('anti-IDOR y control de acceso', () => {
  const app = createApp();
  let anaAgent;
  let garciaAgent;
  let lopezAgent;
  let cs101Id;

  before(async () => {
    anaAgent = await loginAgent(app, ANA);
    garciaAgent = await loginAgent(app, PROF_GARCIA);
    lopezAgent = await loginAgent(app, PROF_LOPEZ);

    // CS-101 lo imparte Garcia.
    const courses = await garciaAgent.get('/api/courses');
    assert.equal(courses.status, 200);
    cs101Id = courses.body.courses.find((c) => c.codigo === 'CS-101').id;
    assert.ok(cs101Id);
  });

  it('estudiante solo ve sus propias notas (derivadas de la sesion)', async () => {
    const res = await anaAgent.get('/api/grades');
    assert.equal(res.status, 200);
    assert.equal(res.body.grades.length, 2); // Ana tiene 2 notas en el seed
    const codigos = res.body.grades.map((g) => g.codigo).sort();
    assert.deepEqual(codigos, ['CS-101', 'CS-102']);
  });

  it('estudiante NO puede crear/editar notas (403)', async () => {
    const res = await anaAgent.put(`/api/grades/${cs101Id}`).send({ studentId: 999, valor: 100 });
    assert.equal(res.status, 403);
  });

  it('estudiante NO puede leer estudiantes ajenos (403)', async () => {
    const res = await anaAgent.get(`/api/courses/${cs101Id}/students`);
    assert.equal(res.status, 403);
  });

  it('profesor NO puede ver estudiantes de un curso que no imparte (403)', async () => {
    const res = await lopezAgent.get(`/api/courses/${cs101Id}/students`);
    assert.equal(res.status, 403);
  });

  it('listados de admin nunca incluyen password_hash', async () => {
    const adminAgent = await loginAgent(app, ADMIN);
    const res = await adminAgent.get('/api/users');
    assert.equal(res.status, 200);
    for (const u of res.body.rows) {
      assert.ok(!('password_hash' in u), 'fila con password_hash expuesto');
    }
  });
});

describe('validacion de entrada', () => {
  const app = createApp();

  it('rechaza contrasena debil en registro (400)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Prueba Debil',
      email: 'debil@universidad.edu',
      password: '12345',
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Datos invalidos.');
  });

  it('rechaza email invalido en registro (400)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Prueba',
      email: 'no-es-un-email',
      password: 'Fuerte123',
    });
    assert.equal(res.status, 400);
  });
});

describe('rate limiting', () => {
  it('bloquea el login tras 5 intentos por minuto (429)', async () => {
    // App fresca para un contador de rate limit limpio.
    const freshApp = createApp();
    let last;
    for (let i = 0; i < 6; i += 1) {
      last = await request(freshApp)
        .post('/api/auth/login')
        .send({ email: 'nadie@universidad.edu', password: 'ClaveIncorrecta1' });
    }
    assert.equal(last.status, 429);
    assert.ok(last.body.error);
  });
});
