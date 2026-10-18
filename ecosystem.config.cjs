module.exports = {
  apps: [
    {
      name: "API.PocketBike",
      script: "./server/entrypoints/apiServer.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        API_PORT: 8084
      }
    },
    {
      name: "Webhook.Wompi",
      script: "./server/entrypoints/webhookServer.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        WEBHOOK_PORT: 8085
      }
    },
    {
      name: "Cron.PocketBike",
      script: "./server/entrypoints/microCronServer.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "250M",
      env: {
        NODE_ENV: "production",
        CRON_PORT: 8086
      }
    },
    {
      name: "Pagos.User",
      script: "./server/entrypoints/payUserServer.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        PAY_USER_PORT: 8087
      }
    },
    {
      name: "Admin.Frontend",
      script: "./server/entrypoints/adminFrontendServer.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "200M",
      env: {
        NODE_ENV: "production",
        ADMIN_FRONTEND_PORT: 8088
      }
    }
  ]
};
