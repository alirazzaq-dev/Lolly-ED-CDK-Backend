#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { LollyEdCdkBackendStack } from '../lib/lolly-ed-cdk-backend-stack';
import { LollyEdCdkFrontendStack } from '../lib/lolly-ed-cdk-backend-stack';



const app = new cdk.App();
new LollyEdCdkBackendStack(app, 'LollyEdCdkBackendStack');
new LollyEdCdkFrontendStack(app, 'LollyEdCdkFrontendStack');
