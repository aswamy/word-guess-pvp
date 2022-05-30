const server = 'http://localhost:3000';

const app = new Vue({
  el: '#app',
  data: {
    socket: null,

    playerName: '',
    gameUuid: '',

    game: null,
    player: null,
    token: null,

    gameHasStarted: false,

    guessWord: '',

    events: [],
  },
  methods: {
    async joinGame() {
      if (!this.playerName) return;

      const response = await fetch(
        `${server}/games/${this.gameUuid || 'new'}`,
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: this.playerName,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        console.error(await response.json());
        return;
      }

      const { game, player, token } = await response.json();

      this.game = game;
      this.player = player;
      this.token = token;

      if (this.game.state === 'ACTIVE') {
        this.gameHasStarted = true;
      }

      this.socket.emit('listenToGame', {
        gameId: this.game.id,
        playerId: this.player.id,
        token: this.token,
      });
    },
    async startGame() {
      this.socket.emit('startGame', {
        gameId: this.game.id,
        token: this.token,
      });
    },
    async makeGuess() {
      if (!this.guessWord) {
        return;
      }
      this.socket.emit('makeGuess', {
        gameId: this.game.id,
        roundId: this.game.currentRound.id,
        playerId: this.player.id,
        token: this.token,
        guess: this.guessWord,
      });
      this.guessWord = '';
    },
    async loadGames() {
      const fetchedGamesResponse = await fetch(`${server}/games`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const games = await fetchedGamesResponse.json();

      console.log(games);
    },
  },
  async created() {
    this.socket = io('http://localhost:3000');

    this.socket.on('playerJoined', ({ playerId, game }) => {
      this.game = game;
      this.events.push(`playerJoined: ${playerId}`);
    });

    this.socket.on('playerLeft', ({ playerId }) => {
      this.events.push(`playerLeft: ${playerId}`);
    });

    this.socket.on('roundBegan', (game) => {
      this.game = game;
      this.gameHasStarted = true;
      this.events.push('roundBegan');
    });

    this.socket.on('roundEnded', (response) => {
      this.game = response.game;
      this.events.push(`roundEnded: Answer was "${response.answer}"`);
    });

    this.socket.on('guessMade', (game) => {
      this.game = game;
      this.events.push('guessMade');
    });

    this.socket.on('gameEnded', (game) => {
      this.game = game;
      this.events.push('gameEnded');
    });

    this.socket.on('makeGuessResponse', ({ guess, validity }) => {
      this.events.push(`makeGuessResponse: "${guess}" is a ${validity} guess`);
    });

    await this.loadGames();
  },
});
