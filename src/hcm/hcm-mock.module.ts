import { Module } from '@nestjs/common';
import { HCMMockController } from './hcm-mock.controller';

@Module({
  controllers: [HCMMockController],
})
export class HCMMockModule {}
