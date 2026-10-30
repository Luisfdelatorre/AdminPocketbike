const path = require("path");

module.exports = {
  apps: [
    {
      name: "micro-cron-service",
      script: path.join(__dirname, "microCronServer.js"),
      instances: 1, // Solo una instancia
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "250M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};

