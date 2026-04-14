// Plain export (no api.env / api.cache) — avoids babel-loader conflict:
// "Caching has already been configured with .never or .forever()"
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: ['last 2 versions', 'not dead'],
      },
    ],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
};
