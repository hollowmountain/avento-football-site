const config = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Тексты коммитов — на русском, ограничение длины мягче дефолта
    'subject-case': [0],
    'body-max-line-length': [1, 'always', 120],
  },
};

export default config;
