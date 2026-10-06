'use strict';

// [E5.2: validación en cliente] Refleja los esquemas zod del servidor (UX
// temprana); la frontera real de confianza es schemas.js en el servidor.
const Validators = {
  email(value) {
    const v = String(value || '').trim();
    if (!v) return 'El correo es obligatorio.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Correo electrónico no válido.';
    return null;
  },
  name(value) {
    const v = String(value || '').trim();
    if (v.length < 2) return 'El nombre debe tener al menos 2 caracteres.';
    if (v.length > 100) return 'El nombre es demasiado largo.';
    return null;
  },
  password(value) {
    const v = String(value || '');
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/.test(v)) {
      return 'La contraseña debe tener entre 8 y 72 caracteres e incluir mayúsculas, minúsculas y números.';
    }
    return null;
  },
  grade(value) {
    const n = Number(value);
    if (Number.isNaN(n) || n < 0 || n > 100) return 'La nota debe estar entre 0 y 100.';
    return null;
  },
};

window.Validators = Validators;
