import { BadRequest } from '../lib/errors.js';
// Validate req.body against a Zod schema, attaching parsed data to req.data
export const validate = (schema) => (req, _res, next) => {
  const r = schema.safeParse(req.body);
  if (!r.success) return next(BadRequest(r.error.issues.map(i => i.message).join('; ')));
  req.data = r.data; next();
};
