module.exports = {
  apps: [
    {
      name: "upay-api",
      cwd: "/srv/upay/api",
      script: "/srv/upay/repo/server/entrypoints/apiServer.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      out_file: "/srv/upay/api/logs/out.log",
      error_file: "/srv/upay/api/logs/error.log",
      merge_logs: true,
      env: {
        NODE_ENV: "production",
        API_PORT: 8184
      }
    },
    {
      name: "upay-webhook",
      cwd: "/srv/upay/webhook",
      script: "/srv/upay/repo/server/entrypoints/webhookServer.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      out_file: "/srv/upay/webhook/logs/out.log",
      error_file: "/srv/upay/webhook/logs/error.log",
      merge_logs: true,
      env: {
        NODE_ENV: "production",
        WEBHOOK_PORT: 8185
      }
    },
    {
      name: "upay-cron",
      cwd: "/srv/upay/cron",
      script: "/srv/upay/repo/server/entrypoints/microCronServer.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "250M",
      out_file: "/srv/upay/cron/logs/out.log",
      error_file: "/srv/upay/cron/logs/error.log",
      merge_logs: true,
      env: {
        NODE_ENV: "production",
        CRON_PORT: 8186
      }
    },
    {
      name: "upay-pay",
      cwd: "/srv/upay/pay",
      script: "/srv/upay/repo/server/entrypoints/payUserServer.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      out_file: "/srv/upay/pay/logs/out.log",
      error_file: "/srv/upay/pay/logs/error.log",
      merge_logs: true,
      env: {
        NODE_ENV: "production",
        PAY_USER_PORT: 8187,
        API_PORT: 8184,
        API_SERVER_URL: "http://127.0.0.1:8184"
      }
    },
    {
      name: "upay-front",
      cwd: "/srv/upay/front",
      script: "/srv/upay/repo/server/entrypoints/adminFrontendServer.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "200M",
      out_file: "/srv/upay/front/logs/out.log",
      error_file: "/srv/upay/front/logs/error.log",
      merge_logs: true,
      env: {
        NODE_ENV: "production",
        ADMIN_FRONTEND_PORT: 8188,
        API_PORT: 8184,
        API_SERVER_URL: "http://127.0.0.1:8184"
      }
    }
  ]
};

