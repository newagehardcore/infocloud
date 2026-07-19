module.exports = {
  extends: [
    'react-app' // Keep react-app, it includes react-hooks internally
  ],
  rules: {
    'import/no-unresolved': 'off',
    'import/no-extraneous-dependencies': 'off',
    // Hooks rules are handled by the 'react-app' preset
  },
  ignorePatterns: ['**/*.map']
}; 