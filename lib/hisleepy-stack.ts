import * as cdk from '@aws-cdk/core';
import * as ecs from '@aws-cdk/aws-ecs';
import * as iam from '@aws-cdk/aws-iam';
import * as ec2 from '@aws-cdk/aws-ec2';
import { FargateTaskDefinition } from '@aws-cdk/aws-ecs';
import { Arn } from '@aws-cdk/core';

export class HiSleepyStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "HiSleepyVPC", {
      subnetConfiguration: [
        {
          name: 'HiSleepySubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        }
      ],
      maxAzs: 1, // One task is plenty
      natGateways: 0, // These things cost 30 bucks a month
    });

    const taskRole = new iam.Role(this, 'HiSleepyTranscribeRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),   // required
    });

    taskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: [Arn.format({
        service: 'ssm',
        resource: 'parameter/hisleepy/*'
      },
        this),
      ],
      actions: ['ssm:GetParameter'],
    }))

    taskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: ['*'],
      actions: ['transcribe:StartStreamTranscription', 'polly:SynthesizeSpeech'],
    }))

    const taskDefinition = new FargateTaskDefinition(this, 'HiSleepyServiceDef', {
      taskRole,
    });

    const logging = new ecs.AwsLogDriver({
      streamPrefix: "hisleepy",
    })

    taskDefinition.addContainer('main', {
      image: ecs.ContainerImage.fromAsset('.'),
      logging,
    })

    new ecs.FargateService(this, 'HiSleepyService', {
      cluster: new ecs.Cluster(this, 'HiSleepyCluster', {
        vpc,
      }),
      taskDefinition,
      assignPublicIp: true
    })
  }
}
