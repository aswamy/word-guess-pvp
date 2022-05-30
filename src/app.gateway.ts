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

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(private readonly gamesService: GamesService) {}

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
      this.startRound(gameId);
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

        if (guessValidity == GuessValidity.valid) {
          this.sendDataToRoom(gameId, 'guessMade', game);
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
        this.sendDataToRoom(client.data.gameId, 'playerLeft', {
          playerId: client.data.playerId,
        });
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

    setTimeout(() => {
      const game = this.gamesService.endRound(gameId);
      const { answer } = game.currentRound;

      this.sendDataToRoom(gameId, 'roundEnded', {
        game,
        answer,
      });

      if (game.state === GameState.finished) {
        this.sendDataToRoom(gameId, 'gameEnded', game);
      } else {
        this.startRound(gameId);
      }
    }, 60_000);
  }

  private sendDataToRoom(roomId: string, title: string, data: any) {
    this.server.to(roomId).emit(title, instanceToPlain(data));
  }
}
