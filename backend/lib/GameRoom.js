import Urne from './Urne.js';
import Univers from './Univers.js';
const U = new Univers();

const GAMESTAT = {
  init: 'after create',
  waitPlayer: 'after first player',
  voteUnivers: 'vote for univers',
  voteThemes: 'vote for themes',
  votePitch: 'pitch composition'
}

const DATA = {
  NEWPLAYER: 'the last add player',
  OLDPLAYER: 'the last removed player',
  PLAYERLIST: 'list of all players',
  VOTESTART: 'the first vote data',
  VOTEUNIVERS: 'data for univers vote',
  VOTETHEMES: 'data for themes vote',
  VOTERSTATUS: 'status des voters'
}

export class GameRoom {

  static io;
  static list = new Map();

  static getUUID () {
    return (Date.now()+Math.floor(Math.random()*10)).toString(36);
  }

  static makeFakePlayer ( randomPseudo ) {

    const gameRoomUUID = 'game-'+GameRoom.getUUID();
    
    console.info('\nA potentiel user is connected');
    console.info('├ random pseudo : ', randomPseudo);
    console.info('└ gameUUID : ' + gameRoomUUID);

    return { 'gameRoomUUID' : gameRoomUUID, 'pseudo' : randomPseudo }

  }

  static makePlayer ( playerdata, socket ) {

    const gameRoom = GameRoom.get( playerdata.gameRoomUUID, GameRoom.io.to(playerdata.gameRoomUUID) );

    if( gameRoom.private ) {
      socket.emit('gameRoom private', JSON.stringify(gameRoom.data()));
      return ;
    }
    
    const player = new Player( socket, playerdata.pseudo );
    Player.list.set( player.uuid, player );
    gameRoom.addPlayer( player );

  }

  static removePlayer ( uuid ) {

    const player = Player.list.get(uuid);
    if( player === undefined ) return false;

    player.remove(uuid);

  }

  static get ( uuid, ioRoom ) {
    if( GameRoom.list.has(uuid) )
      return GameRoom.list.get(uuid);
    else {
      const gameRoom = new GameRoom( uuid, ioRoom );
      GameRoom.list.set(uuid, gameRoom);
      return gameRoom;
    }
  }


  stat = GAMESTAT.init;

  uuid;
  #ioRoom;
  playerList = new Map();
  lastAddPlayer;
  lastRMPlayer;
  private = false;

  univer;

  electorList = new Urne();

  constructor ( _uuid, ioRoom ) {
    this.uuid = _uuid;
    this.#ioRoom = GameRoom.io;

    this.stepOne();
  }

  addPlayer(player) {

    player.addGameRoom( this );
    this.playerList.set( player.uuid, player );
    this.lastAddPlayer = player.uuid;

    this.electorList.addVoter( player.pseudo, player.uuid );

    console.info('\nWelcome to new challenger !');
    console.info('├ pseudo : ' + player.pseudo);
    console.info('└ gameRoomUUID : ' + this.uuid);

    player.join( this.uuid );

    player.emit('switch to wait room',
      JSON.stringify(this.data(
        DATA.VOTESTART
      )));

    this.#ioRoom.emit('update game data',
      JSON.stringify(this.data(
        DATA.NEWPLAYER,
        DATA.PLAYERLIST,
        DATA.VOTERSTATUS
      )));

  }

  removePlayer ( uuid ) {

    const player = this.playerList.get( uuid );
    this.lastRMPlayer = uuid;

    this.electorList.removeVoter( player.pseudo );

    console.info('\nA user is disconnect');
    console.info('├ removeplayer : ' + player.pseudo);
    console.info('└ gameRoomUUID : ' + this.uuid);

    delete this.playerList.delete(uuid);

    this.#ioRoom.emit('update game data',
      JSON.stringify(this.data(
        DATA.OLDPLAYER,
        DATA.PLAYERLIST,
        DATA.VOTERSTATUS
      )));
  }

  dataMethods = {
    [DATA.NEWPLAYER]:   () => ({ newPlayer: this.playerList.get(this.lastAddPlayer) }),
    [DATA.OLDPLAYER]:   () => ({ removeplayer: this.playerList.get(this.lastRMPlayer) }),
    [DATA.PLAYERLIST]:  () => ({ playerList: [...this.playerList.values()] }),
    [DATA.VOTESTART]:   () => ({ candidates: [{ name: 'yes', title: 'Aller, on joue, là !' }] }),
    [DATA.VOTEUNIVERS]: () => ({ candidates: U.getUniversTitles() }),
    [DATA.VOTETHEMES]:  () => ({ candidates: U.getThemesTitles(this.univer) }),
    [DATA.VOTERSTATUS]: () => ({ voterStatus: this.electionProgress.getVoterStatusList() })
  };

  data( _ ) {
    let data = { 'gameRoomUUID' : this.uuid };

    [...arguments].forEach(arg => {
      if (this.dataMethods[arg]) {
        data = { ...data, ...this.dataMethods[arg]() };
      } else {
        data = { ...data, ...arg };
      }
    });

    return data;
  }

  generalVote ( playerUUID, vote ) {
    const player = this.playerList.get( playerUUID );
    const voter = this.electorList.getVoter( player.pseudo );
    const election = this.electorList.getElection ( vote.election );
    const candidate = election.getCandidate ( vote.candidate );
    const results = election.submitVote( voter, candidate );

    console.info('\nPlayer as voted !');
    console.info('├ election : ', election.name);
    console.info('├ player : ', voter.name);
    console.info('├ candidate : ', candidate.name);
    console.info('└ results : ', results);
  }






  stepOne() {

    console.info('\nGAMESTAT : ', this.stat);
    
    this.electionProgress = this.electorList.addElection({
      name: 'start',
      candidates: ['yes'],
      actionVote: (results, voterStatus) => this.#ioRoom.emit('start vote', results, voterStatus),
      actionVoted: (results, winner) => this.stepUniversVote( results, winner )
    });

    this.stat = GAMESTAT.waitPlayer;
    console.info('\nGAMESTAT : ', this.stat);


  }

  stepUniversVote( results, winner ) {

    this.private = true;
    this.#ioRoom.emit('switch univers vote',
      JSON.stringify(this.data(
        {winner: winner.name},
        DATA.VOTEUNIVERS
      )));

    this.electionProgress = this.electorList.addElection({
      name: 'univers',
      candidates: U.getUniversList(),
      actionVote: (results, voterStatus) => this.#ioRoom.emit('univers vote', results, voterStatus),
      actionVoted: (results, winner) => this.stepThemesVote( results, winner )
    });

    this.stat = GAMESTAT.voteUnivers;
    console.info('\nGAMESTAT : ', this.stat);

  }

  stepThemesVote( results, winner ) {

    this.univer = winner.name;

    this.#ioRoom.emit('switch themes vote',
      JSON.stringify(this.data(
        {winner: winner.name},
        DATA.VOTETHEMES
      )));
    
    this.electionProgress = this.electorList.addElection({
      name: 'themes',
      candidates: U.getThemesFor( this.univer ),
      actionVote: (results, voterStatus) => this.#ioRoom.emit('themes vote', results, voterStatus),
      actionVoted: (results, winner) => this.stepPitchVote( results, winner )
    });

    this.stat = GAMESTAT.voteThemes;
    console.info('\nGAMESTAT : ', this.stat);

  }

  stepPitchVote( results, winner ) {

    this.theme = winner.name;

    this.#ioRoom.emit('switch pitch vote',
      JSON.stringify(this.data(
        {winner: winner.name},
        U.getTheme(winner.name)/*,
        DATA.VOTETHEMES*/
      )));

    const [ _, editor] = [...this.playerList][~~(Math.random() * this.playerList.size)];

    this.#ioRoom.emit('update game data',
      JSON.stringify(this.data(
        {editor: editor}
      )));

    editor.emit('Editor is you');
    
    
    /*this.electorList.addElection({
      name: 'themes',
      candidates: U.getThemesFor( this.univer ),
      actionVote: (results) => this.#ioRoom.emit('themes vote', results),
      actionVoted: (results, winner) => this.stepUniverVote( results, winner )
        //this.univer = winner.name;
        //this.stepTwo( results, winner );
        //this.#ioRoom.emit('switch themes vote', results, winner.name);
    });*/

    this.stat = GAMESTAT.votePitch;
    console.info('\nGAMESTAT : ', this.stat);

  }

}

export class Player {

  static list = new Map();

  #socket;
  uuid;
  pseudo;
  #gameRoom;

  constructor ( _socket, _pseudo ) {
    this.#socket = _socket;
    this.uuid = _socket.id;
    this.pseudo = _pseudo;
  }

  addGameRoom( _gameRoom ) {
    this.#gameRoom = _gameRoom;
  }

  join( _ ) { this.#socket.join(...arguments) }

  emit( _ ) { this.#socket.emit(...arguments) }

  remove( uuid ) {
    this.#gameRoom.removePlayer(uuid);
  }

  get gameRoom() {
    return this.#gameRoom;
  }

}