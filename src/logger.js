const config = require("./config");

class Logger {
  // HTTP request/response logging middleware
  httpLogger = (req, res, next) => {
    // Capture the start time for latency tracking
    const startTime = Date.now();

    // Store original res.send to intercept response
    const originalSend = res.send;
    let responseBody;

    res.send = function (data) {
      responseBody = data;
      originalSend.call(this, data);
    };

    // Log when response finishes
    res.on("finish", () => {
      const latency = Date.now() - startTime;

      // Parse responseBody if it's a string
      let parsedResponseBody = responseBody;
      if (typeof responseBody === "string") {
        try {
          parsedResponseBody = JSON.parse(responseBody);
        } catch {
          // If it's not valid JSON, keep it as a string
          parsedResponseBody = responseBody;
        }
      }

      this.log("info", "HTTP request", {
        type: "general",
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        hasAuth: !!req.headers.authorization,
        requestBody: JSON.stringify(this.sanitize(req.body)),
        responseBody: JSON.stringify(this.sanitize(parsedResponseBody)),
        latency,
      });
    });

    next();
  };

  // General logging method
  log(level, message, details = {}) {
    const logEntry = {
      level,
      message: typeof message === "string" ? message : JSON.stringify(message),
      timestamp: Date.now(),
      ...details,
    };

    this.sendLogToGrafana(logEntry);
  }

  // Log database queries
  logDatabase(query, params) {
    this.log("info", "Database query", {
      type: "database",
      query: this.sanitize(query),
      params: this.sanitize(params),
    });
  }

  // Log factory service requests
  logFactory(operation, requestBody, responseBody, statusCode) {
    this.log("info", "Factory service call", {
      type: "factory",
      operation,
      requestBody: JSON.stringify(this.sanitize(requestBody)),
      responseBody: JSON.stringify(this.sanitize(responseBody)),
      statusCode,
    });
  }

  // Log unhandled exceptions
  logException(error, context = {}) {
    this.log("error", "Unhandled exception", {
      type: "exception",
      error: error.message,
      stack: error.stack,
      ...this.sanitize(context),
    });
  }

  // Sanitize sensitive information from logs
  sanitize(data) {
    if (!data) return data;

    // Handle different data types
    if (typeof data === "string") {
      return this.sanitizeString(data);
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item));
    }

    if (typeof data === "object") {
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        // Remove sensitive fields
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes("password") ||
          lowerKey.includes("token") ||
          lowerKey.includes("jwt") ||
          lowerKey.includes("secret") ||
          lowerKey.includes("apikey") ||
          lowerKey.includes("authorization")
        ) {
          sanitized[key] = "***REDACTED***";
        } else {
          sanitized[key] = this.sanitize(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  sanitizeString(str) {
    // Redact JWT tokens in strings
    return str.replace(
      /Bearer\s+[\w-]+\.[\w-]+\.[\w-]+/gi,
      "Bearer ***REDACTED***"
    );
  }

  // Send log to Grafana Loki
  sendLogToGrafana(logEntry) {
    // Skip logging if config is not available (e.g., during tests)
    if (!config.logging || !config.logging.url) {
      return;
    }

    // Format for Loki
    const streams = [
      {
        stream: {
          app: config.logging.source,
          level: logEntry.level || "info",
          type: logEntry.type || "general",
        },
        values: [
          [
            `${logEntry.timestamp}000000`, // Loki expects nanoseconds
            JSON.stringify({
              message: logEntry.message,
              ...logEntry,
            }),
          ],
        ],
      },
    ];

    const body = JSON.stringify({ streams });

    fetch(config.logging.url, {
      method: "POST",
      body: body,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.logging.userId}:${config.logging.apiKey}`,
      },
    })
      .then((res) => {
        if (!res.ok) {
          console.error("Failed to send log to Grafana:", res.statusText);
        }
      })
      .catch((error) => {
        console.error("Error sending log to Grafana:", error);
      });
  }
}

// Export singleton instance
const logger = new Logger();
module.exports = logger;
