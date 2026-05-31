module.exports = {
  apps: [
    {
      name: 'license-server',

      script: './dist/index.js',

      instances: 6,
      exec_mode: 'cluster',

      max_memory_restart: '300M',

      env: {
        NODE_ENV: 'production',
        PORT: 3400,
      },
    },
  ],
};