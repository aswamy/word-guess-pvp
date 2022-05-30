import { v4 as uuidv4 } from 'uuid';

import { ProductionExclude } from '../../utility';

export class Player {
  id: string;
  name: string;

  @ProductionExclude()
  token: string;

  constructor(name: string) {
    this.id = uuidv4();
    this.name = name;
    this.token = uuidv4();
  }
}
