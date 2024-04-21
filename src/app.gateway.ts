import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayInit,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';

import { Logger } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { GamesService, GuessValidity } from './games/games.service';
import { instanceToPlain } from 'class-transformer';
import { GameState } from './games/entities/game.entity';

@WebSocketGateway(3003, {
  cors: {
    origin: '*',
  },
})
export class AppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly gamesService: GamesService) { }

  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('AppGateway');

  @SubscribeMessage('listenToGame')
  handleListenToGame(
    client: Socket,
    {
      gameId,
      playerId,
      token,
    }: { gameId: string; playerId: string; token: string },
  ): void {
    this.logger.log(`Client ${client.id} is listening to game ${gameId}`);

    const game = this.gamesService.findOne(gameId);
    if (game) {
      client.data.gameId = gameId;
      client.join(gameId);

      if (this.gamesService.isAuthorizedPlayerOfGame(token, gameId, playerId)) {
        client.data.playerId = playerId;

        this.sendDataToRoom(client.data.gameId, 'playerJoined', {
          playerId: client.data.playerId,
          game,
        });
      }
    }
  }

  @SubscribeMessage('startGame')
  handleStartGame(
    client: Socket,
    { gameId, token }: { gameId: string; token: string },
  ): void {
    this.logger.log(`Client ${client.id} attempted to start game ${gameId}`);

    if (this.gamesService.isAuthorizedHostOfGame(token, gameId)) {
      this.gamesService.startGame(gameId);

      setTimeout(() => {
        this.startRound(gameId);
      }, 3_000);
    }
  }

  @SubscribeMessage('makeGuess')
  handleMakeGuess(
    client: Socket,
    {
      gameId,
      roundId,
      playerId,
      token,
      guess,
    }: {
      gameId: string;
      roundId: string;
      playerId: string;
      token: string;
      guess: string;
    },
  ): void {
    if (this.gamesService.isAuthorizedPlayerOfGame(token, gameId, playerId)) {
      const game = this.gamesService.findOne(gameId);

      if (game) {
        const guessValidity = this.gamesService.guessWord(
          gameId,
          roundId,
          playerId,
          guess,
        );

        this.server.to(client.id).emit('makeGuessResponse', {
          guess,
          validity: guessValidity,
        });

        if (guessValidity === GuessValidity.valid) {
          this.sendDataToRoom(gameId, 'guessMade', game);
        }

        // check the game and every player to see if they already hit max guesses
        if (!game.arePlayersStillGuessing()) {
          this.handleEndRound(game.id);
        }
      }
    }
  }

  afterInit(server: Server) {
    this.logger.log('Websockets are ready');
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    if (client.data.gameId) {
      if (client.data.playerId) {
        const game = this.gamesService.findOne(client.data.gameId);

        if (game) {
          game.players.delete(client.data.playerId);

          this.sendDataToRoom(client.data.gameId, 'playerLeft', {
            playerId: client.data.playerId,
          });

          this.handleEndRound(game.id);
        }
      }

      const clientSocketIds = await this.server
        .in(client.data.gameId)
        .allSockets();

      if (clientSocketIds.size == 0) {
        this.gamesService.remove(client.data.gameId);
      }
    }
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  private startRound(gameId: string) {
    const game = this.gamesService.startRound(gameId);

    this.sendDataToRoom(gameId, 'roundBegan', game);

    game.currentRoundTimeout = setTimeout(() => {
      this.handleEndRound(gameId);
    }, 30_000);
  }

  private handleEndRound(gameId: string) {
    const game = this.gamesService.endRound(gameId);

    if (!game.currentRound) return;

    const { answer } = game.currentRound;

    this.sendDataToRoom(gameId, 'roundEnded', {
      game,
      answer,
    });

    if (game.state === GameState.finished) {
      this.sendDataToRoom(gameId, 'gameEnded', game);
    } else {
      setTimeout(() => {
        this.startRound(gameId);
      }, 10_000);
    }
  }

  private sendDataToRoom(roomId: string, title: string, data: any) {
    this.server.to(roomId).emit(title, instanceToPlain(data));
  }
}
