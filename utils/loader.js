/**
 * loader.js — Fetches and parses YAML data files
 * Requires js-yaml to be loaded before this script
 */

const Loader = (() => {
  const cache = {};

  async function fetchYAML(path) {
    if (cache[path]) return cache[path];
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`HTTP ${response.status} loading ${path}`);
      const text = await response.text();
      const data = jsyaml.load(text);
      cache[path] = data;
      return data;
    } catch (err) {
      console.error(`[Loader] Failed to load ${path}:`, err);
      throw err;
    }
  }

  async function loadDomains() {
    const data = await fetchYAML('./data/domains.yml');
    return data.domains || [];
  }

  async function loadFlashcards(domainId) {
    const data = await fetchYAML(`./data/flashcards/${domainId}.yml`);
    return data.flashcards || [];
  }

  async function loadAllFlashcards(domains) {
    const results = await Promise.allSettled(
      domains.map(d => loadFlashcards(d.id))
    );
    return results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);
  }

  async function loadQuestions(domainId) {
    const data = await fetchYAML(`./data/questions/${domainId}.yml`);
    return data.questions || [];
  }

  async function loadAllQuestions(domains) {
    const results = await Promise.allSettled(
      domains.map(d => loadQuestions(d.id))
    );
    return results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);
  }

  return { loadDomains, loadFlashcards, loadAllFlashcards, loadQuestions, loadAllQuestions };
})();
