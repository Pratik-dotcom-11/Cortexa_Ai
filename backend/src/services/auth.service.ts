import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { db, isDbActive } from '../config/database.ts';
import { users } from '../models/schema.ts';
import { hashPassword, verifyPassword } from '../utils/password.ts';
import { signToken, revokeToken } from '../utils/jwt.ts';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';

// Sanitize user inputs to prevent stored XSS and injection
export const sanitizeString = (val?: string | null): string => {
  if (!val || typeof val !== 'string') return '';
  return val
    .trim()
    .replace(/[<>]/g, '') // Strip HTML angle brackets
    .slice(0, 500); // Reasonable upper bound
};

// In-memory fallback cache in case DB table is provisioning or offline in dev
const memoryUsers = new Map<string, any>();

export interface SignupInput {
  email: string;
  password: string;
  displayName?: string;
  university?: string;
  major?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export const authService = {
  async signup(data: SignupInput) {
    const normalizedEmail = data.email.toLowerCase().trim();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new BadRequestError('A valid email address is required');
    }
    if (!data.password || typeof data.password !== 'string' || data.password.length < 8) {
      throw new BadRequestError('Password must be at least 8 characters long');
    }
    if (data.password.length > 128) {
      throw new BadRequestError('Password cannot exceed 128 characters');
    }

    const sanitizedDisplayName = sanitizeString(data.displayName) || null;
    const sanitizedUniversity = sanitizeString(data.university) || null;
    const sanitizedMajor = sanitizeString(data.major) || null;

    const uid = `user_${crypto.randomUUID()}`;
    const passwordHash = hashPassword(data.password);

    if (isDbActive()) {
      try {
        // Check if user already exists in DB
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.email, normalizedEmail))
          .limit(1);

        if (existing.length > 0) {
          throw new BadRequestError('User with this email already exists');
        }

        const [created] = await db
          .insert(users)
          .values({
            uid,
            email: normalizedEmail,
            passwordHash,
            displayName: sanitizedDisplayName,
            university: sanitizedUniversity,
            major: sanitizedMajor,
          })
          .returning();

        const userRecord = created || {
          uid,
          email: normalizedEmail,
          displayName: sanitizedDisplayName,
        };

        memoryUsers.set(normalizedEmail, {
          ...userRecord,
          passwordHash,
        });

        const token = signToken({
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName || undefined,
        });

        // Strip secret before returning
        const { passwordHash: _, ...safeUser } = userRecord as any;

        return {
          user: safeUser,
          token,
        };
      } catch (err: any) {
        if (err instanceof BadRequestError) throw err;
        logger.debug(`Postgres signup notice: ${err.message}`);
      }
    }

    // Fallback for memory store
    if (memoryUsers.has(normalizedEmail)) {
      throw new BadRequestError('User with this email already exists');
    }

    const userRecord = {
      id: memoryUsers.size + 1,
      uid,
      email: normalizedEmail,
      passwordHash,
      displayName: sanitizedDisplayName || 'Student',
      university: sanitizedUniversity || '',
      major: sanitizedMajor || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryUsers.set(normalizedEmail, userRecord);

    const token = signToken({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
    });

    const { passwordHash: _, ...safeUser } = userRecord;
    return { user: safeUser, token };
  },

  async login(data: LoginInput) {
    const normalizedEmail = data.email.toLowerCase().trim();

    if (isDbActive()) {
      try {
        const [userRecord] = await db
          .select()
          .from(users)
          .where(eq(users.email, normalizedEmail))
          .limit(1);

        if (userRecord && userRecord.passwordHash) {
          const isMatch = verifyPassword(data.password, userRecord.passwordHash);
          if (isMatch) {
            const token = signToken({
              uid: userRecord.uid,
              email: userRecord.email,
              displayName: userRecord.displayName || undefined,
            });

            const { passwordHash: _, ...safeUser } = userRecord;
            return {
              user: safeUser,
              token,
            };
          }
        }
      } catch (err: any) {
        logger.debug(`Postgres login notice: ${err.message}`);
      }
    }

    // Check in memory fallback
    const memUser = memoryUsers.get(normalizedEmail);
    if (memUser && verifyPassword(data.password, memUser.passwordHash)) {
      const token = signToken({
        uid: memUser.uid,
        email: memUser.email,
        displayName: memUser.displayName,
      });
      const { passwordHash: _, ...safeUser } = memUser;
      return { user: safeUser, token };
    }

    throw new UnauthorizedError('Invalid email or password');
  },

  async getCurrentUser(uid: string) {
    if (isDbActive()) {
      try {
        const [userRecord] = await db
          .select()
          .from(users)
          .where(eq(users.uid, uid))
          .limit(1);

        if (userRecord) {
          const { passwordHash: _, ...safeUser } = userRecord;
          return safeUser;
        }
      } catch (err: any) {
        logger.debug(`Postgres user lookup notice: ${err.message}`);
      }
    }

    // Check memory store
    for (const memUser of memoryUsers.values()) {
      if (memUser.uid === uid) {
        const { passwordHash: _, ...safeUser } = memUser;
        return safeUser;
      }
    }

    // Demo student fallback
    if (uid.startsWith('student-') || uid.startsWith('user_')) {
      return {
        uid,
        email: 'student@university.edu',
        displayName: 'Alex Rivera (Demo Student)',
        university: 'State University',
        major: 'Computer Science',
      };
    }

    throw new NotFoundError('User profile not found');
  },

  async logout(token?: string) {
    if (token) {
      revokeToken(token);
    }
    return { success: true, message: 'Logged out successfully' };
  },

  async demoLogin(role: string = 'cs') {
    const profiles: Record<string, { uid: string; email: string; displayName: string; university: string; major: string }> = {
      cs: {
        uid: 'student-alex-demo',
        email: 'alex.rivera@university.edu',
        displayName: 'Alex Rivera (Demo Student)',
        university: 'State University',
        major: 'Computer Science',
      },
      bio: {
        uid: 'student-sarah-demo',
        email: 'sarah.chen@university.edu',
        displayName: 'Sarah Chen (Demo Student)',
        university: 'State University',
        major: 'Molecular Biology',
      },
      econ: {
        uid: 'student-jordan-demo',
        email: 'jordan.patel@university.edu',
        displayName: 'Jordan Patel (Demo Student)',
        university: 'State University',
        major: 'Economics & Finance',
      },
    };

    const selected = profiles[role] || profiles.cs;

    if (isDbActive()) {
      try {
        await db
          .insert(users)
          .values({
            uid: selected.uid,
            email: selected.email,
            displayName: selected.displayName,
            university: selected.university,
            major: selected.major,
          })
          .onConflictDoUpdate({
            target: users.uid,
            set: {
              email: selected.email,
              displayName: selected.displayName,
              university: selected.university,
              major: selected.major,
              updatedAt: new Date(),
            },
          });
      } catch (e: any) {
        logger.debug(`Postgres demoLogin notice: ${e.message}`);
      }
    }

    // Memory sync
    memoryUsers.set(selected.email, {
      id: memoryUsers.size + 1,
      ...selected,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Cryptographically sign a standard JWT
    const token = signToken({
      uid: selected.uid,
      email: selected.email,
      displayName: selected.displayName,
    });

    return {
      user: selected,
      token,
    };
  },

  async syncUser(uid: string, email: string, displayName?: string, photoUrl?: string, university?: string, major?: string) {
    if (isDbActive()) {
      try {
        const [result] = await db
          .insert(users)
          .values({
            uid,
            email: email.toLowerCase().trim(),
            displayName: displayName || null,
            photoUrl: photoUrl || null,
            university: university || null,
            major: major || null,
          })
          .onConflictDoUpdate({
            target: users.uid,
            set: {
              email: email.toLowerCase().trim(),
              ...(displayName ? { displayName } : {}),
              ...(photoUrl ? { photoUrl } : {}),
              ...(university ? { university } : {}),
              ...(major ? { major } : {}),
              updatedAt: new Date(),
            },
          })
          .returning();

        if (result) {
          const { passwordHash: _, ...safe } = result;
          memoryUsers.set(email.toLowerCase().trim(), safe);
          return safe;
        }
      } catch (err: any) {
        logger.debug(`Postgres syncUser notice: ${err.message}`);
      }
    }

    const safeUser = {
      uid,
      email: email.toLowerCase().trim(),
      displayName: displayName || 'Alex Rivera (Demo Student)',
      photoUrl: photoUrl || '',
      university: university || 'State University',
      major: major || 'Computer Science',
    };
    memoryUsers.set(email.toLowerCase().trim(), safeUser);
    return safeUser;
  },

  async updateProfile(uid: string, data: { displayName?: string; university?: string; major?: string }) {
    if (isDbActive()) {
      try {
        const [updated] = await db
          .update(users)
          .set({
            ...data,
            updatedAt: new Date(),
          })
          .where(eq(users.uid, uid))
          .returning();

        if (updated) {
          const { passwordHash: _, ...safe } = updated;
          return safe;
        }
      } catch (err: any) {
        logger.debug(`Postgres updateProfile notice: ${err.message}`);
      }
    }

    return {
      uid,
      displayName: data.displayName || 'Alex Rivera (Demo Student)',
      university: data.university || 'State University',
      major: data.major || 'Computer Science',
    };
  },
};
