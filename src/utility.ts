import { Exclude } from 'class-transformer';

const ProductionExclude =
  process.env.NODE_ENV === 'production' ? Exclude : () => () => {};

export { ProductionExclude };
