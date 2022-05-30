import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { validate as uuidValidate } from 'uuid';
import { GamesService } from './games.service';
import { GameState } from './entities/game.entity';
import { Player } from './entities/player.entity';

enum ErrorCodes {
  INVALID_GAME_ID = 'INVALID_GAME_ID',
  GAME_IN_PROGRESS = 'GAME_IN_PROGRESS',
}

@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Post('new')
  createGame(@Body() { playerName }: { playerName: string }) {
    const player = new Player(playerName);

    return {
      game: this.gamesService.createGame(player),
      player,
      token: player.token,
    };
  }

  @Post(':id')
  joinGame(
    @Body() { playerName }: { playerName: string },
    @Param('id') id: string,
  ) {
    if (!uuidValidate(id)) {
      throw new BadRequestException(ErrorCodes.INVALID_GAME_ID);
    }

    const player = new Player(playerName);

    let game = this.gamesService.findOne(id);

    if (game) {
      if (game.state != GameState.lobby) {
        throw new BadRequestException(ErrorCodes.GAME_IN_PROGRESS);
      }
      game.players.set(player.id, player);
    } else {
      game = this.gamesService.createGame(player);
    }

    return {
      game,
      player,
      token: player.token,
    };
  }

  @Get()
  findAll() {
    return this.gamesService.findAll();
  }
}
