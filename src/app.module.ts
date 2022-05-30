import { Module } from '@nestjs/common';
import { AppGateway } from './app.gateway';
import { GamesModule } from './games/games.module';

@Module({
  imports: [GamesModule],
  controllers: [],
  providers: [AppGateway],
})
export class AppModule {}
