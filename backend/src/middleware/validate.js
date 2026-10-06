'use strict';

const { ZodError } = require('zod');

/**
 * Middleware de validacion con zod.
 * Recibe un esquema zod con forma { body?, query?, params? } y valida cada
 * parte de la request. Devuelve 400 con mensajes por campo en caso de error.
 * Uso: validate(loginSchema) donde loginSchema = z.object({ body: ... }).
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (parsed.body !== undefined) req.body = parsed.body;
      // req.query es de solo-lectura en Express 5: se valida pero no se reasigna.
      if (parsed.params !== undefined) Object.assign(req.params, parsed.params);
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Datos invalidos.',
          details: err.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
      }
      return next(err);
    }
  };
}

module.exports = { validate };
