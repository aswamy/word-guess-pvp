import { Player } from './player.entity';
import { Round, RoundState } from './round.entity';
import { Exclude, Transform } from 'class-transformer';

const MAX_ROUNDS = 3;

export enum GameState {
  lobby = 'LOBBY',
  active = 'ACTIVE',
  finished = 'FINISHED',
}

export class Game {
  id: string;
  host: Player;
  state: GameState;
  currentRound: Round;

  @Exclude()
  currentRoundTimeout: NodeJS.Timeout;

  @Transform(({ value }) => value.size)
  rounds: Map<string, Round>;

  @Transform(({ value }) => Object.fromEntries(value))
  players: Map<string, Player>;

  constructor(roomCode: string, host: Player) {
    this.id = roomCode;
    this.host = host;

    this.currentRound = null;
    this.currentRoundTimeout = null;

    this.state = GameState.lobby;

    this.rounds = new Map();
    this.players = new Map().set(host.id, host);
  }

  startGame() {
    this.state = GameState.active;
  }

  startRound(word: string) {
    if (this.state === GameState.finished) {
      return;
    }

    const round = new Round(this.id, word, [...this.players.values()]);

    this.currentRound = round;
    this.rounds.set(round.id, round);
  }

  endRound() {
    if (this.currentRound) {
      this.currentRound.state = RoundState.finished;
    }

    if (this.currentRoundTimeout) {
      clearTimeout(this.currentRoundTimeout);
    }
    this.currentRoundTimeout = null;

    if (this.rounds.size >= MAX_ROUNDS) {
      this.state = GameState.finished;
    }
  }

  arePlayersStillGuessing() {
    if (!this.currentRound) return false;
    if (this.currentRound.state === RoundState.finished) return false;

    return [...this.players.values()]
      .some(player => this.currentRound.isPlayerStillGuessing(player.id));
  }
}
