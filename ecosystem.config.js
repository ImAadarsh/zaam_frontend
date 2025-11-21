module.exports = {
  apps: [
    {
      name: 'zaam-panels',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: '/var/www/zaam/zaam-panels',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/pm2/zaam-panels-error.log',
      out_file: '/var/log/pm2/zaam-panels-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};

