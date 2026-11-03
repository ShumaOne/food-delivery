const { defineConfig } = require('vite');
const path = require('path');

module.exports = defineConfig({
  root: path.join(__dirname, 'client'),
  publicDir: false,
  build: {
    outDir: path.join(__dirname, 'public'),
    emptyOutDir: false,
  },
});
