const config = require('./config');
const os = require('os');

class MetricsCollector {
  constructor() {
    this.httpMetrics = {
      total: 0,
      get: 0,
      post: 0,
      put: 0,
      delete: 0,
    };

    this.authMetrics = {
      success: 0,
      failure: 0,
    };

    // Track users with their last activity timestamp
    this.activeUsers = new Map(); // userId -> timestamp
    this.ACTIVE_USER_WINDOW = 10 * 60 * 1000; // 10 minutes in milliseconds

    this.pizzaMetrics = {
      sold: 0,
      failures: 0,
      revenue: 0,
    };

    this.latencyMetrics = {
      serviceTotal: 0,
      serviceCount: 0,
      pizzaCreationTotal: 0,
      pizzaCreationCount: 0,
    };

    // Start periodic reporting
    this.sendMetricsPeriodically(10000); // Every 10 seconds
  }

  // Middleware to track HTTP requests
  requestTracker = (req, res, next) => {
    const startTime = Date.now();

    // Track request method
    this.httpMetrics.total++;
    const method = req.method.toLowerCase();
    if (this.httpMetrics[method] !== undefined) {
      this.httpMetrics[method]++;
    }

    // Track active users (if authenticated)
    if (req.user?.id) {
      this.activeUsers.set(req.user.id, Date.now());
    }

    // Track authentication attempts (login endpoint is PUT /api/auth)
    const isLoginAttempt = req.method === 'PUT' && req.originalUrl === '/api/auth';
    if (isLoginAttempt) {
      res.on('finish', () => {
        if (res.statusCode === 200) {
          this.authMetrics.success++;
        } else {
          this.authMetrics.failure++;
        }
      });
    }

    // Track service latency
    res.on('finish', () => {
      const latency = Date.now() - startTime;
      this.latencyMetrics.serviceTotal += latency;
      this.latencyMetrics.serviceCount++;
    });

    next();
  };

  // Track pizza purchases
  pizzaPurchase(success, latency, price) {
    if (success) {
      this.pizzaMetrics.sold++;
      this.pizzaMetrics.revenue += price;
    } else {
      this.pizzaMetrics.failures++;
    }

    this.latencyMetrics.pizzaCreationTotal += latency;
    this.latencyMetrics.pizzaCreationCount++;
  }

  // Get count of active users (within time window)
  getActiveUserCount() {
    const now = Date.now();
    const cutoffTime = now - this.ACTIVE_USER_WINDOW;

    // Remove stale users
    for (const [userId, timestamp] of this.activeUsers.entries()) {
      if (timestamp < cutoffTime) {
        this.activeUsers.delete(userId);
      }
    }

    return this.activeUsers.size;
  }

  // Get system metrics
  getCpuUsagePercentage() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    return (cpuUsage * 100).toFixed(2);
  }

  getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;
    return memoryUsage.toFixed(2);
  }

  // Send all metrics to Grafana
  sendMetricsPeriodically(period) {
    setInterval(() => {
      try {
        this.sendMetricToGrafana('http_requests_total', this.httpMetrics.total, 'counter');
        this.sendMetricToGrafana('http_requests_get', this.httpMetrics.get, 'counter');
        this.sendMetricToGrafana('http_requests_post', this.httpMetrics.post, 'counter');
        this.sendMetricToGrafana('http_requests_put', this.httpMetrics.put, 'counter');
        this.sendMetricToGrafana('http_requests_delete', this.httpMetrics.delete, 'counter');

        this.sendMetricToGrafana('auth_success', this.authMetrics.success, 'counter');
        this.sendMetricToGrafana('auth_failure', this.authMetrics.failure, 'counter');

        this.sendMetricToGrafana('active_users', this.getActiveUserCount(), 'gauge');

        this.sendMetricToGrafana('pizza_sold', this.pizzaMetrics.sold, 'counter');
        this.sendMetricToGrafana('pizza_failures', this.pizzaMetrics.failures, 'counter');
        this.sendMetricToGrafana('pizza_revenue', this.pizzaMetrics.revenue, 'counter');

        const avgServiceLatency =
          this.latencyMetrics.serviceCount > 0
            ? this.latencyMetrics.serviceTotal / this.latencyMetrics.serviceCount
            : 0;
        const avgPizzaLatency =
          this.latencyMetrics.pizzaCreationCount > 0
            ? this.latencyMetrics.pizzaCreationTotal / this.latencyMetrics.pizzaCreationCount
            : 0;

        this.sendMetricToGrafana('service_latency_avg', avgServiceLatency, 'gauge');
        this.sendMetricToGrafana('pizza_creation_latency_avg', avgPizzaLatency, 'gauge');

        this.sendMetricToGrafana('cpu_usage', parseFloat(this.getCpuUsagePercentage()), 'gauge');
        this.sendMetricToGrafana('memory_usage', parseFloat(this.getMemoryUsagePercentage()), 'gauge');
      } catch (error) {
        console.error('Error sending metrics:', error);
      }
    }, period);
  }

  // Send individual metric to Grafana
  sendMetricToGrafana(metricName, metricValue, metricType) {
    // Build the metric payload based on type
    let metricData;
    if (metricType === 'counter') {
      metricData = {
        sum: {
          dataPoints: [
            {
              asDouble: metricValue,
              timeUnixNano: Date.now() * 1000000,
            },
          ],
          aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
          isMonotonic: true,
        },
      };
    } else {
      // gauge
      metricData = {
        gauge: {
          dataPoints: [
            {
              asDouble: metricValue,
              timeUnixNano: Date.now() * 1000000,
            },
          ],
        },
      };
    }

    const metric = {
      resourceMetrics: [
        {
          resource: {
            attributes: [
              {
                key: 'service.name',
                value: { stringValue: config.metrics.source },
              },
            ],
          },
          scopeMetrics: [
            {
              metrics: [
                {
                  name: metricName,
                  ...metricData,
                },
              ],
            },
          ],
        },
      ],
    };

    const body = JSON.stringify(metric);

    fetch(config.metrics.url, {
      method: 'POST',
      body: body,
      headers: {
        Authorization: `Bearer ${config.metrics.apiKey}`,
        'Content-Type': 'application/json',
      },
    })
      .then((response) => {
        if (!response.ok) {
          response.text().then((text) => {
            console.error(`Failed to push metrics to Grafana: ${text}`);
          });
        } else {
          console.log(`Pushed ${metricName}: ${metricValue}`);
        }
      })
      .catch((error) => {
        console.error('Error pushing metrics:', error);
      });
  }
}

// Export a singleton instance
const metrics = new MetricsCollector();
module.exports = metrics;
