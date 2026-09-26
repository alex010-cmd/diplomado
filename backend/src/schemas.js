'use strict';

// [E5.2: validación en servidor + E5.1: defensa en profundidad] Frontera de
// confianza: todo input se valida aquí con zod antes de tocar la BD o la lógica.
// El cliente replica estas reglas (public/js/validation.js) solo para UX.

const { z } = require('zod');

// Politica de contrasenas: minimo 8 caracteres, con mayuscula, minuscula y digito.
// (maximo 72 por limitacion de bcrypt).
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;
const PASSWORD_MESSAGE =
  'La contrasena debe tener entre 8 y 72 caracteres e incluir mayusculas, minusculas y numeros.';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Correo electronico no valido.')
  .max(254);

const password = z
  .string()
  .regex(PASSWORD_REGEX, PASSWORD_MESSAGE);

const name = z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.').max(100);

const role = z.enum(['admin', 'profesor', 'estudiante']);

const idParam = z.object({
  id: z.coerce.number().int().positive('ID invalido.'),
});

const searchQuery = z.object({
  search: z.string().trim().max(100).optional(),
});

const loginSchema = z.object({
  body: z.object({
    email,
    password: z.string().min(1, 'La contrasena es obligatoria.').max(100),
  }),
});

const registerSchema = z.object({
  body: z.object({
    name,
    email,
    password,
  }),
});

const createUserSchema = z.object({
  body: z.object({
    name,
    email,
    password,
    role,
  }),
});

const updateUserSchema = z.object({
  params: idParam,
  body: z.object({
    name: name.optional(),
    role: role.optional(),
    active: z.boolean().optional(),
  }),
});

const createCourseSchema = z.object({
  body: z.object({
    codigo: z.string().trim().min(1, 'El codigo es obligatorio.').max(20),
    nombre: z.string().trim().min(2, 'El nombre es obligatorio.').max(120),
    descripcion: z.string().trim().max(500).optional(),
    profesorId: z.number().int().positive().optional(),
  }),
});

const updateCourseSchema = z.object({
  params: idParam,
  body: z.object({
    codigo: z.string().trim().min(1).max(20).optional(),
    nombre: z.string().trim().min(2).max(120).optional(),
    descripcion: z.string().trim().max(500).nullable().optional(),
    profesorId: z.number().int().positive().nullable().optional(),
    active: z.boolean().optional(),
  }),
});

const enrollSchema = z.object({
  params: idParam,
  body: z.object({
    studentId: z.number().int().positive('ID de estudiante invalido.'),
  }),
});

const upsertGradeSchema = z.object({
  params: idParam,
  body: z.object({
    studentId: z.number().int().positive('ID de estudiante invalido.'),
    valor: z.number().min(0, 'La nota debe ser >= 0.').max(100, 'La nota debe ser <= 100.'),
  }),
});

// Esquemas de solo-parametros/query (para rutas GET/DELETE sin cuerpo).
const courseIdParamSchema = z.object({ params: idParam });
const userSearchSchema = z.object({ query: searchQuery });

module.exports = {
  loginSchema,
  registerSchema,
  createUserSchema,
  updateUserSchema,
  createCourseSchema,
  updateCourseSchema,
  enrollSchema,
  upsertGradeSchema,
  courseIdParamSchema,
  userSearchSchema,
  idParam,
  searchQuery,
  PASSWORD_MESSAGE,
};
