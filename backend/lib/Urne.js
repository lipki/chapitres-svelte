/**
 * Classe représentant une urne électorale. Elle gère les électeurs, les élections et les votes.
 */
export default class Urne {

  /** @type {Map<string, Urne>} */
  static #electorLists = new Map();

  /**
   * Génère un identifiant unique.
   * @returns {string}
   */
  static getUUID () {
    return (Date.now()+Math.floor(Math.random()*10000)).toString(36);
  }


  /** @type {string} */
  #uuid;
  /** @type {Map<string, Voter>} */
  #voterList = new Map();
  /** @type {Map<string, Election>} */
  #electionList = new Map();

  constructor () {
    this.#uuid = Urne.getUUID();
    Urne.#electorLists.set(this.#uuid, this);
  }

  /**
   * Ajoute un électeur à l'urne.
   * @param {string} _voter - Le nom de l'électeur.
   * @returns {Voter}
   */
  addVoter ( _voter, uuid ) {
    let voter = new Voter( this.#voterList, _voter, uuid );
    return voter;
  }

  /**
   * Supprime un électeur.
   * @param {string} _voter - Nom de l'électeur à supprimer.
   */
  removeVoter ( _voter ) {
    const voter = this.getVoter(_voter);
    if (voter) this.#voterList.delete( voter.uuid );
  }

  /**
   * Crée une nouvelle élection si elle n'existe pas.
   * @param {{ name: string, candidates: string[], actionVote?: Function, actionVoted?: Function }} _electionData
   * @returns {Election}
   */
  addElection ( _electionData ) {

    let election = this.getElection ( _electionData.name );

    if(election) return election;

    election = new Election( this, _electionData.name );
    _electionData.candidates.forEach(candidate => election.addCandidate(candidate));
    election.actionVote = _electionData.actionVote;
    election.actionVoted = _electionData.actionVoted;

    return election;
  }

  /**
   * Récupère une élection par nom.
   * @param {string} name
   * @returns {Election|undefined}
   */
  getElection ( name ) {
    return [...this.#electionList.values()]
      .find( _election => _election.name === name );
  }

  /**
   * Récupère un électeur par nom.
   * @param {string} name
   * @returns {Voter|undefined}
   */
  getVoter ( name ) {
    return [...this.#voterList.values()]
      .find( _voter => _voter.name === name );
  }

  /** @returns {Map<string, Voter>} */
  get voterList() {
    return this.#voterList;
  }

  /** @returns {Map<string, Election>} */
  get electionList() {
    return this.#electionList;
  }

}

/**
 * Classe représentant une élection.
 */
class Election {

  /** @type {Urne} */
  #electorList;
  /** @type {string} */
  #uuid;
  /** @type {Map<string, Candidate>} */
  #candidateList = new Map();
  /** @type {boolean} */
  #votingClosed = false;
  /** @type {Map<string, Object>} */
  #recordedVotes = new Map();

  /** @type {string} */
  name;
  /** @type {Candidate|undefined} */
  winnerIs;
  /** @type {Function} */
  actionVote;
  /** @type {Function} */
  actionVoted;

  /**
   * @param {Urne} _electorList
   * @param {string} _name
   */
  constructor ( _electorList, _name ) {
    this.#uuid = Urne.getUUID();
    this.name = _name;
    this.#electorList = _electorList;
    _electorList.electionList.set(this.#uuid, this);
  }

  /**
   * Ajoute un candidat à l’élection.
   * @param {string} _candidate
   * @returns {Candidate}
   */
  addCandidate ( _candidate ) {
    let candidate = new Candidate( this.#candidateList, _candidate );
    return candidate;
  }

  /**
   * Soumet ou retire un vote.
   * @param {Voter} voter
   * @param {Candidate} candidate
   * @returns {Array<{ name: string, votes: number, percentage: number }>|1}
   */
  submitVote ( voter, candidate ) {
    // Si l'élection est fermée, renvoyer une erreur
    if (this.#votingClosed) {
      console.error("Urne : Les votes sont clos pour cette éléction.");
      return 1;
    }

    // Clé unique pour voter + election + candidat
    const key = `${voter.uuid}_${candidate.uuid}`;

    // Vérifier si le vote existe déjà
    if (this.#recordedVotes.has(key)) {
      this.#recordedVotes.delete(key);  // Supprimer le vote existant
      const results = this.getResults();
      if (this.actionVote) this.actionVote(results, this.getVoterStatusList());  // Appeler l'action de vote si définie
      return this.getResults();
    }

    // Si aucun vote n'existe pour cette clé, enregistrer un nouveau vote
    this.#recordedVotes.set(key, { 
      uuid: key,
      voter: voter.uuid,
      candidate: candidate.uuid
    });

    const results = this.getResults();
    if( this.actionVote ) this.actionVote( results, this.getVoterStatusList() );

    // Si la progression atteint 100%, fermer l'élection et appeler l'action associée
    if ( this.hasUnanimity () ) {
      this.#votingClosed = true;
      if (this.actionVoted) this.actionVoted( results, this.winnerIs );
    }

    return results;
  }

  /**
   * Vérifie s’il y a unanimité.
   * @returns {Candidate|undefined}
   */
  hasUnanimity () {
    const totalVotes = this.#electorList.voterList.size;
    const voteCounts = {};
    let progress = {};

    // Compter le nombre de votes pour chaque candidat
    [...this.#recordedVotes]
      .forEach(([uuid, vote]) => {
        voteCounts[vote.candidate] = voteCounts[vote.candidate] ? voteCounts[vote.candidate]+1 : 1;
        progress[vote.candidate] = voteCounts[vote.candidate] / totalVotes;
      })

    const winner = Object.entries(progress).find(([key, percent]) => percent === 1);
    if( winner ) this.winnerIs = this.#candidateList.get(winner[0]);
    return this.winnerIs;
  }

  /**
   * Récupère un candidat par son nom.
   * @param {string} name
   * @returns {Candidate|undefined}
   */
  getCandidate ( name ) {
    return [...this.#candidateList.values()]
      .find( _candidate => _candidate.name === name );
  }

  /**
   * Obtient la liste des votants avec leur nom, leur UUID et leur statut de vote.
   * @returns {Array} Liste des votants avec leur nom, uuid, et statut de vote
   */
  getVoterStatusList() {

    const voters = [...this.#electorList.voterList.values()];

    return voters.map(voter => {

      const hasVoted = [...this.#recordedVotes.values()]
        .some(vote => vote.voter === voter.uuid);

      return {
        uuid: voter.uuid,
        name: voter.name,
        hasVoted: hasVoted
      };
    })

  }

  /**
   * Retourne les résultats actuels de l’élection.
   * @returns {Array<{ name: string, votes: number, percentage: number }>}
   */
  getResults () {
    const votes = [...this.#recordedVotes.values()];
  
    const totalVoters = this.#electorList.voterList.size;
    const resultMap = new Map();
  
    // Initialisation des résultats avec 0 vote
    for (let [uuid, candidate] of this.candidateList.entries()) {
      resultMap.set(uuid, { name: candidate.name, votes: 0, percentage: 0 });
    }
  
    // Comptage des votes
    for (let vote of votes) {
      const result = resultMap.get(vote.candidate);
      if (result) {
        result.votes += 1;
        result.percentage = totalVoters > 0
          ? result.votes / totalVoters : 0;
      }
    }
  
    // Conversion en tableau pour faciliter l'affichage
    return [...resultMap.values()];
  }

  /** @returns {string} */
  get uuid() {
    return this.#uuid;
  }

  /** @returns {Map<string, Candidate>} */
  get candidateList() {
    return this.#candidateList;
  }

}

/**
 * Représente un électeur.
 */
class Voter {

  /** @type {string} */
  #uuid;

  /** @type {string} */
  name;

  /**
   * @param {Map<string, Voter>} voterList
   * @param {string} _name
   */
  constructor ( voterList, _name, _uuid ) {
    this.#uuid = _uuid ?? Urne.getUUID();
    this.name = _name;
    voterList.set(this.#uuid, this);
  }

  /** @returns {string} */
  get uuid() {
    return this.#uuid;
  }

}

/**
 * Représente un candidat.
 */
class Candidate {

  /** @type {string} */
  #uuid;

  /** @type {string} */
  name;


  /**
   * @param {Map<string, Candidate>} candidateList
   * @param {string} _name
   */
  constructor ( candidateList, _name ) {
    this.#uuid = Urne.getUUID();
    this.name = _name;
    candidateList.set(this.#uuid, this);
  }

  /** @returns {string} */
  get uuid() {
    return this.#uuid;
  }

}