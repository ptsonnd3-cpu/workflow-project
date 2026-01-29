const { body, param, query, validationResult } = require('express-validator');
const helmet = require('helmet');

// Security middleware setup
function setupSecurity(app) {
  // Basic security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // Rate limiting (simple in-memory implementation)
  const rateLimitStore = new Map();
  app.use((req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 1000; // Max requests per window

    if (!rateLimitStore.has(ip)) {
      rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const limit = rateLimitStore.get(ip);
    if (now > limit.resetTime) {
      limit.count = 1;
      limit.resetTime = now + windowMs;
    } else {
      limit.count++;
    }

    if (limit.count > maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests',
        retryAfter: Math.ceil((limit.resetTime - now) / 1000)
      });
    }

    next();
  });
}

// Validation error handler
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
}

// Workflow validation rules
const workflowValidation = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Name must be between 3 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_àáâãéêíóôõúăđĩũơưạảấầẩẫậắằẳẵặếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]+$/)
    .withMessage('Name contains invalid characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('version')
    .isInt({ min: 1, max: 999 })
    .withMessage('Version must be a positive integer between 1 and 999')
];

// Activity validation rules
const activityValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Activity name must be between 2 and 100 characters'),
  body('type')
    .isIn(['user', 'role', 'department', 'group', 'service'])
    .withMessage('Invalid activity type'),
  body('handler')
    .if(body('type').equals('service'))
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Service handler is required and must be between 2-50 characters')
];

// Transition validation rules
const transitionValidation = [
  body('from_activity_id')
    .isInt({ min: 1 })
    .withMessage('From activity ID must be a positive integer'),
  body('to_activity_id')
    .isInt({ min: 1 })
    .withMessage('To activity ID must be a positive integer'),
  body('condition')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Condition must be between 1 and 200 characters'),
  body('priority')
    .optional()
    .isInt({ min: 0, max: 999 })
    .withMessage('Priority must be between 0 and 999'),
  body('is_default')
    .optional()
    .isBoolean()
    .withMessage('is_default must be a boolean')
];

// BPMN XML validation
const bpmnValidation = [
  body('bpmnXml')
    .trim()
    .isLength({ min: 50, max: 1000000 }) // Max 1MB
    .withMessage('BPMN XML must be between 50 characters and 1MB')
    .custom((value) => {
      // Basic XML structure validation
      if (!value.includes('<?xml') || !value.includes('<definitions')) {
        throw new Error('Invalid BPMN XML format');
      }
      
      // Check for dangerous content
      const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /vbscript:/i,
        /onload=/i,
        /onerror=/i,
        /<!DOCTYPE.*ENTITY/i
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(value)) {
          throw new Error('BPMN XML contains potentially dangerous content');
        }
      }
      
      return true;
    })
];

// ID parameter validation
const idParamValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer')
];

// Query parameter validation for outbox
const outboxQueryValidation = [
  query('status')
    .optional()
    .isIn(['', 'PENDING', 'DONE', 'FAILED'])
    .withMessage('Status must be PENDING, DONE, or FAILED')
];

module.exports = {
  setupSecurity,
  handleValidationErrors,
  workflowValidation,
  activityValidation,
  transitionValidation,
  bpmnValidation,
  idParamValidation,
  outboxQueryValidation
};