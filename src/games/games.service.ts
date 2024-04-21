import { Injectable } from '@nestjs/common';
import { Player } from './entities/player.entity';
import { Game } from './entities/game.entity';
import { generateRoomCode } from '../utils/generateRoomCode';

const fs = require('fs');

class WordFactory {
  private static availableWords = fs
    .readFileSync('./resources/word_list.txt', { encoding: 'utf8', flag: 'r' })
    .split(/\r?\n/);

  static allWords = new Set(this.availableWords);

  static generateWord(): string {
    const randomIndex = Math.floor(Math.random() * this.availableWords.length);
    return this.availableWords[randomIndex];
  }
}

export enum GuessValidity {
  valid = 'valid',
  invalid = 'invalid',
}

@Injectable()
export class GamesService {
  private readonly games: Map<string, Game> = new Map();

  createGame(player: Player): Game {
    let roomCode = generateRoomCode();

    while (this.games.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const g = new Game(roomCode, player);
    this.games.set(roomCode, g);

    return g;
  }

  findAll(): Game[] {
    return [...this.games.values()];
  }

  findOne(id: string): Game {
    return this.games.get(id);
  }

  remove(id: string): void {
    this.games.delete(id);
  }

  startGame(id: string) {
    const game = this.findOne(id);

    if (game) {
      if (game.players.size === 0) {
        console.error(`Can't start Game#${id} without players`);
      } else {
        game.startGame();
      }
    } else {
      console.error(`Couldn't find Game#${id}.`);
    }

    return game;
  }

  isAuthorizedHostOfGame(token: string, gameId: string) {
    const game = this.findOne(gameId);

    if (game) {
      return game.host.token === token;
    }

    return false;
  }

  isAuthorizedPlayerOfGame(token: string, gameId: string, playerId: string) {
    const game = this.findOne(gameId);

    if (game) {
      const player = game.players.get(playerId);

      return player.token === token;
    }

    return false;
  }

  startRound(id: string) {
    const game = this.findOne(id);

    game.startRound(WordFactory.generateWord());

    return game;
  }

  endRound(id: string) {
    const game = this.findOne(id);

    game.endRound();

    return game;
  }

  guessWord(
    id: string,
    roundId: string,
    playerId: string,
    guess: string,
  ): GuessValidity {
    const game = this.findOne(id);

    if (WordFactory.allWords.has(guess) && game) {
      if (game.rounds.get(roundId).addGuess(playerId, guess)) {
        return GuessValidity.valid;
      }
    }

    return GuessValidity.invalid;
  }
}
