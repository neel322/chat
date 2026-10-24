const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const configured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

let upload;
if (configured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  upload = multer({
    storage: new CloudinaryStorage({
      cloudinary,
      params: { folder: 'chat-app', resource_type: 'auto' }
    }),
    limits: { fileSize: 25 * 1024 * 1024 }
  });
} else {
  upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
}

module.exports = { cloudinary, upload, cloudinaryConfigured: configured };
