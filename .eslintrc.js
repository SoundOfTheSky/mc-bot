module.exports = {
  parser: '@babel/eslint-parser',
  plugins: ['prettier'],
  extends: ['eslint:recommended', 'plugin:prettier/recommended'],
  env: { node: true, es2020: true },
  rules: {
    'no-unused-vars': 'warn',
    'prettier/prettier': 'warn',
  },
};
