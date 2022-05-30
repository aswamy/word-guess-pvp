import { v4 as uuidv4 } from 'uuid';
import { Player } from './player.entity';
import { Round, RoundState } from './round.entity';
import { Transform } from 'class-transformer';

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

  @Transform(({ value }) => value.size)
  rounds: Map<string, Round>;

  @Transform(({ value }) => Object.fromEntries(value))
  players: Map<string, Player>;

  constructor(host: Player) {
    this.id = uuidv4();
    this.host = host;
    this.currentRound = null;

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

    if (this.rounds.size >= MAX_ROUNDS) {
      this.state = GameState.finished;
    }
  }
}
