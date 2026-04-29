import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { logger } from '../utils/logger';

// Use persistent disk on Render, local filesystem in development
const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
const baseDir = isProduction ? '/var/data' : path.join(process.cwd(), 'uploads');

// Ensure upload directories exist
const uploadsDir = baseDir;
const contentsDir = path.join(uploadsDir, 'contents');
const clientsDir = path.join(uploadsDir, 'clients');
const enforcementsDir = path.join(uploadsDir, 'enforcements');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(contentsDir)) {
  fs.mkdirSync(contentsDir, { recursive: true });
}

if (!fs.existsSync(clientsDir)) {
  fs.mkdirSync(clientsDir, { recursive: true });
}

if (!fs.existsSync(enforcementsDir)) {
  fs.mkdirSync(enforcementsDir, { recursive: true });
}

// Configure storage for content images
const contentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, contentsDir);
  },
  filename: (req, file, cb) => {
    // Get slug from request body
    const slug = req.body.slug || 'content';
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const filename = `${slug}-${timestamp}${extension}`;
    cb(null, filename);
  },
});

// File filter to allow only images
const imageFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Accept only image files
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG images are allowed.'
      )
    );
  }
};

// Configure multer for content image uploads
export const uploadContentImage = multer({
  storage: contentStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
}).single('image'); // Field name is 'image'

// Configure storage for client logos
const clientLogoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, clientsDir);
  },
  filename: (req, file, cb) => {
    // Get client name from request body, sanitize it for filename
    const clientName = req.body.name || 'client';
    const sanitizedName = clientName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const filename = `${sanitizedName}-${timestamp}${extension}`;
    cb(null, filename);
  },
});

// Configure multer for client logo uploads
export const uploadClientLogo = multer({
  storage: clientLogoStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
}).single('logo'); // Field name is 'logo'

// File filter to allow only PDF files
const pdfFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Accept only PDF files
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Only PDF files are allowed for enforcement documents.'
      )
    );
  }
};

// Configure storage for enforcement PDF files
const enforcementStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, enforcementsDir);
  },
  filename: (req, file, cb) => {
    // Get subject name or document ID from request body, sanitize it for filename
    const subjectName =
      req.body.subjectName || req.body.documentId || 'enforcement';
    const sanitizedName = subjectName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const filename = `${sanitizedName}-${timestamp}${extension}`;
    cb(null, filename);
  },
});

// Configure multer for enforcement PDF uploads
export const uploadEnforcementPdf = multer({
  storage: enforcementStorage,
  fileFilter: pdfFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
}).single('enforcementFile'); // Field name is 'enforcementFile'

// File filter to allow only CSV files
const csvFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/csv',
  ];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) || fileExtension === '.csv') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only CSV files are allowed.'));
  }
};

// Configure storage for CSV bulk uploads
const csvStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, enforcementsDir);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const sanitizedName = file.originalname
      .replace(/[^a-z0-9.-]/gi, '-')
      .replace(/-+/g, '-');
    const filename = `bulk-upload-${timestamp}-${sanitizedName}`;
    cb(null, filename);
  },
});

// Configure multer for CSV bulk uploads
export const uploadEnforcementCsv = multer({
  storage: csvStorage,
  fileFilter: csvFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
}).single('file'); // Field name is 'file'

// Helper function to delete old PDF when updating
export const deleteOldPdf = (pdfPath: string): void => {
  if (!pdfPath) return;

  const fullPath = path.join(enforcementsDir, pdfPath);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
      logger.info({ pdfPath }, 'Deleted old enforcement PDF');
    } catch (error) {
      logger.error({ err: error, pdfPath }, 'Error deleting old enforcement PDF');
    }
  }
};

// Helper function to delete old image when updating
export const deleteOldImage = (
  imagePath: string,
  type: 'content' | 'client' = 'content'
): void => {
  if (!imagePath) return;

  const directory = type === 'client' ? clientsDir : contentsDir;
  const fullPath = path.join(directory, imagePath);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
      logger.info({ type, imagePath }, 'Deleted old image');
    } catch (error) {
      logger.error({ err: error, type, imagePath }, 'Error deleting old image');
    }
  }
};
