#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { HiSleepyStack } from '../lib/hisleepy-stack';

const app = new cdk.App();
new HiSleepyStack(app, 'HiSleepyStack');
