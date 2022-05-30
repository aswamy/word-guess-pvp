import { v4 as uuidv4 } from 'uuid';
import { Player } from './player.entity';
import { ProductionExclude } from '../../utility';
import { Expose } from 'class-transformer';

const MAX_GUESSES = 6;

export enum RoundState {
  active = 'ACTIVE',
  finished = 'FINISHED',
}

export enum GuessHint {
  none = 'NONE',
  exists = 'EXISTS',
  found = 'FOUND',
}

export class Round {
  id: string;
  gameId: string;

  @ProductionExclude()
  answer: string;

  @ProductionExclude()
  playerGuesses: Map<string, Array<string>> = new Map();

  state: RoundState;

  constructor(gameId: string, answer: string, players: Player[]) {
    this.id = uuidv4();
    this.gameId = gameId;
    this.answer = answer;

    players.forEach((player) => {
      this.playerGuesses.set(player.id, []);
    });

    this.state = RoundState.active;
  }

  addGuess(playerId: string, guess: string) {
    if (this.state === RoundState.finished) {
      console.error(
        `Round#${this.id} is already finished for Game#${this.gameId}`,
      );
      return;
    }

    if (!this.playerGuesses.has(playerId)) {
      console.error(
        `Player#${playerId} does not belong to Game#${this.gameId}`,
      );
      return;
    }

    const guesses = this.playerGuesses.get(playerId);

    const guessesCount = guesses.length;

    if (
      guesses[guessesCount - 1] != this.answer &&
      guessesCount < MAX_GUESSES
    ) {
      guesses.push(guess);
    }
  }

  @Expose()
  get scoreBoard() {
    const scoresPerPlayer = {};
    for (const [playerId, guesses] of this.playerGuesses) {
      let score = 0;
      if (guesses[guesses.length - 1] == this.answer) {
        score = 100 - (guesses.length - 1) * 10;
      }
      scoresPerPlayer[playerId] = score;
    }
    return scoresPerPlayer;
  }

  @Expose()
  get guessHints() {
    const hintsPerPlayer = {};
    for (const [playerId, guesses] of this.playerGuesses) {
      hintsPerPlayer[playerId] = [];
      for (const guess of guesses) {
        const guessLetters = guess.split('');
        const guessHint = [];
        for (let i = 0; i < this.answer.length; i++) {
          if (guessLetters[i] == this.answer[i]) {
            guessHint.push(GuessHint.found);
          } else if (this.answer.indexOf(guessLetters[i]) > -1) {
            guessHint.push(GuessHint.exists);
          } else {
            guessHint.push(GuessHint.none);
          }
        }
        hintsPerPlayer[playerId].push(guessHint);
      }
    }
    return hintsPerPlayer;
  }
}
