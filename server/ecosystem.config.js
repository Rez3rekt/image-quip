module.exports = {
  apps: [
    {
      name: 'chirped',
      script: 'server.js',
      instances: 1, // Can be increased for load balancing
      exec_mode: 'fork', // Use 'cluster' for multiple instances
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Process management
      watch: false, // Set to true for development auto-restart
      ignore_watch: ['node_modules', 'logs', 'uploads', 'data'],
      max_memory_restart: '1G',
      
      // Restart policy
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Health monitoring
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // Environment-specific settings
      node_args: '--max-old-space-size=1024',
      repo: 'git@github.com:yourusername/chirped.git',
      path: '/var/www/chirped',
    },
  ],
  
  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/image-quip.git',
      path: '/var/www/image-quip',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
    },
  },
}; 