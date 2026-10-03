import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '../utils/errors.ts';
import { MAX_FILE_SIZE_BYTES } from '../services/document.service.ts';

// Configure multer memory storage
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES, // 15MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const originalLower = file.originalname.toLowerCase();
    const isPdf =
      originalLower.endsWith('.pdf') ||
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/x-pdf' ||
      file.mimetype === 'application/octet-stream';

    const isImage =
      originalLower.endsWith('.jpg') ||
      originalLower.endsWith('.jpeg') ||
      originalLower.endsWith('.png') ||
      originalLower.endsWith('.webp') ||
      file.mimetype.startsWith('image/');

    if (isPdf || isImage) {
      cb(null, true);
    } else {
      cb(
        new BadRequestError(
          'Upload failed: Unsupported file format. Please upload a PDF document (.pdf) or image of study notes (.jpg, .jpeg, .png, .webp).',
        ),
      );
    }
  },
});

export const singleMaterialUpload = (req: Request, res: Response, next: NextFunction) => {
  const uploadSingle = upload.single('file');

  uploadSingle(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new BadRequestError(
              `Upload failed: File exceeds the maximum allowed size of ${(MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0)}MB`,
            ),
          );
        }
        return next(new BadRequestError(`Upload failed: ${err.message}`));
      }
      return next(err);
    }
    next();
  });
};

// Backward-compatible alias
export const singlePdfUpload = singleMaterialUpload;
