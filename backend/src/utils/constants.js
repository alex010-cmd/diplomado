'use strict';

const ROLES = Object.freeze({
  ADMIN: 'admin',
  PROFESOR: 'profesor',
  ESTUDIANTE: 'estudiante',
});

const COOKIES = Object.freeze({
  ACCESS: 'access_token',
  REFRESH: 'refresh_token',
});

const RESULT = Object.freeze({
  SUCCESS: 'success',
  FAILURE: 'failure',
  DENIED: 'denied',
});

const ACTIONS = Object.freeze({
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILURE: 'login_failure',
  LOGOUT: 'logout',
  REGISTER: 'register',
  REFRESH: 'token_refresh',
  ACCESS_DENIED: 'access_denied',
  USER_CREATE: 'user_create',
  USER_UPDATE: 'user_update',
  COURSE_CREATE: 'course_create',
  COURSE_UPDATE: 'course_update',
  COURSE_DELETE: 'course_delete',
  ENROLL: 'enroll',
  GRADE_UPSERT: 'grade_upsert',
});

module.exports = { ROLES, COOKIES, RESULT, ACTIONS };
