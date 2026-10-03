import { Request } from 'express';
import { validateRequest, isValidEmail } from './validation.util.ts';

export const validateSignup = validateRequest([
  (req: Request) => {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !isValidEmail(email.trim()) || email.trim().length > 254) {
      return 'A valid email address (max 254 characters) is required';
    }
    return null;
  },
  (req: Request) => {
    const { password } = req.body;
    if (!password || typeof password !== 'string' || password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (password.length > 128) {
      return 'Password cannot exceed 128 characters';
    }
    return null;
  },
  (req: Request) => {
    const { displayName } = req.body;
    if (displayName !== undefined && (typeof displayName !== 'string' || displayName.trim().length > 100)) {
      return 'Display name cannot exceed 100 characters';
    }
    return null;
  },
]);

export const validateLogin = validateRequest([
  (req: Request) => {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !isValidEmail(email.trim())) {
      return 'A valid email address is required';
    }
    return null;
  },
  (req: Request) => {
    const { password } = req.body;
    if (!password || typeof password !== 'string' || !password.trim()) {
      return 'Password is required';
    }
    if (password.length > 128) {
      return 'Invalid credentials';
    }
    return null;
  },
]);
