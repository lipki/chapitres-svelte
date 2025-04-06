import universData from '../assets/univers.json' with { type: 'json' };


/**
 * Classe représentant un univers de jeu avec ses thèmes et autres données associées.
 * Permet de récupérer des informations sur les univers, les thèmes et de manipuler les mots aléatoires.
 */
export default class Univers {

  /**
   * Données de l'univers.
   * @private
   * @type {Object}
   */
  #data;

  /**
   * Ensemble des mots déjà utilisés pour éviter les répétitions.
   * @private
   * @type {Set<string>}
   */
  #usedWords = new Set();

  constructor() {
    this.#data = universData;
  }

  /**
   * Obtient la liste des univers.
   * @returns {string[]} Un tableau des clés des univers qui contiennent des thèmes.
   */
  getUniversList() {
    return Object.keys(this.#data).filter(key => this.#data[key].themes);
  }

  /**
   * Obtient les titres des univers.
   * @returns {Array<{ name: string, title: string }>} Un tableau d'objets avec les clés d'univers et leurs titres.
   */
  getUniversTitles() {
    return Object.entries(this.#data)
      .filter(([_, value]) => value.title)
      .map(([key, value]) => ({
        name: key,
        title: value.title
      }));
  }

  /**
   * Récupère un thème spécifique par son nom, dans tous les univers.
   * @param {string} themeName - Le nom du thème à récupérer.
   * @returns {object|null} Le thème trouvé ou null si non trouvé.
   */
  getTheme(themeName) {
    for (const universe of Object.values(this.#data)) {
      if (universe.themes && universe.themes[themeName]) {
        return universe.themes[themeName];
      }
    }
    return null;
  }

  /**
   * Obtient la liste des thèmes pour un univers donné.
   * @param {string} universeKey - La clé de l'univers pour lequel obtenir les thèmes.
   * @returns {string[]} Un tableau des clés des thèmes de l'univers spécifié.
   */
  getThemesFor(universeKey) {
    const universe = this.#data[universeKey];
    return universe?.themes ? Object.keys(universe.themes) : [];
  }
  
  /**
   * Obtient les titres et les détails des thèmes pour un univers donné.
   * @param {string} universeKey - La clé de l'univers pour lequel obtenir les titres des thèmes.
   * @returns {Array<{ name: string, title: string, pitch: string }>} Un tableau d'objets contenant le nom, le titre et le pitch de chaque thème.
   */
  getThemesTitles(universeKey) {
    const universe = this.#data[universeKey];
    if (!universe || !universe.themes) return [];
  
    return Object.entries(universe.themes).map(([key, value]) => ({
      name: key,
      title: value.title,
      pitch: value.pitch
    }));
  }

  /**
   * Obtient le titre d'un univers ou d'un thème donné.
   * @param {string} key - La clé de l'univers ou du thème pour lequel obtenir le titre.
   * @returns {string|null} Le titre de l'univers ou du thème, ou null si aucun titre n'est trouvé.
   */
  getTitle(key) {
    if (this.#data[key]?.title) return this.#data[key].title;

    for (const universe of Object.values(this.#data)) {
      if (universe.themes?.[key]?.title) return universe.themes[key].title;
    }

    return null;
  }

  /**
   * Obtient le pitch d'un thème d'un univers donné.
   * @param {string} universeKey - La clé de l'univers auquel appartient le thème.
   * @param {string} themeKey - La clé du thème pour lequel obtenir le pitch.
   * @returns {string|null} Le pitch du thème, ou null si le pitch n'existe pas.
   */
  getPitch(universeKey, themeKey) {
    return this.#data[universeKey]?.themes?.[themeKey]?.pitch || null;
  }

  /**
   * Obtient un mot aléatoire unique d'un univers ou d'un contexte donné.
   * Le mot ne doit pas avoir été utilisé auparavant.
   * @param {string} [context='neutre'] - Le contexte (univers) à partir duquel obtenir un mot. Par défaut, 'neutre'.
   * @returns {string|null} Un mot aléatoire du contexte donné, ou null si aucun mot disponible.
   */
  getRandomWord(context = 'neutre') {
    const wordList = this.#data[context]?.words || [];
    const available = wordList.filter(word => !this.#usedWords.has(word));
    if (available.length === 0) return null;

    const word = available[Math.floor(Math.random() * available.length)];
    this.#usedWords.add(word);
    return word;
  }

  /**
   * Réinitialise les mots utilisés, permettant d'utiliser à nouveau tous les mots.
   */
  resetUsedWords() {
    this.#usedWords.clear();
  }
}