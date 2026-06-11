// Typed app errors -> consistent JSON responses.
export class AppError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export const BadRequest   = (m='Bad request')   => new AppError(400, 'bad_request', m);
export const Unauthorized = (m='Unauthorized')  => new AppError(401, 'unauthorized', m);
export const Forbidden    = (m='Forbidden')     => new AppError(403, 'forbidden', m);
export const NotFound     = (m='Not found')     => new AppError(404, 'not_found', m);
export const Conflict     = (m='Conflict')      => new AppError(409, 'conflict', m);
