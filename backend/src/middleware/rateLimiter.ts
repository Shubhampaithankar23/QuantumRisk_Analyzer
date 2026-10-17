import rateLimit from 'express-rate-limit';

export const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
});

export const scanLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Max 10 scans per minute to protect network and hosts
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Scan rate limit reached. Please wait a minute before requesting another scan.',
  },
});
