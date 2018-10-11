/**
 * See https://docs.aws.amazon.com/codepipeline/latest/userguide/detect-state-changes-cloudwatch-events.html
 */
export type CodePipelineState =
  | 'STARTED'
  | 'SUCCEEDED'
  | 'RESUMED'
  | 'FAILED'
  | 'CANCELED'
  | 'SUPERSEDED';

export type CodePipelineStageState =
  | 'STARTED'
  | 'SUCCEEDED'
  | 'RESUMED'
  | 'FAILED'
  | 'CANCELED';

export type CodePipelineActionState =
  | 'STARTED'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELED';

export interface CodePipelinePiplelineEvent {
  version: string;
  id: string;
  'detail-type': 'CodePipeline Pipeline Execution State Change';
  source: 'aws.codepipeline';
  account: string;
  time: string;
  region: string;
  resources: string[];
  detail: {
    pipeline: string;
    version: number;
    state: CodePipelineState;
    'execution-id': string;
  };
}

export interface CodePipelineStageEvent {
  version: string;
  id: string;
  'detail-type': 'CodePipeline Stage Execution State Change';
  source: 'aws.codepipeline';
  account: string;
  time: string;
  region: string;
  resources: string[];
  detail: {
    pipeline: string;
    version: number;
    'execution-id': string;
    stage: string;
    state: CodePipelineStageState;
  };
}

export type CodePipelineActionCategory =
  | 'Approval'
  | 'Build'
  | 'Deploy'
  | 'Invoke'
  | 'Source'
  | 'Test';

export interface CodePipelineActionEvent {
  version: string;
  id: string;
  'detail-type': 'CodePipeline Action Execution State Change';
  source: 'aws.codepipeline';
  account: string;
  time: string;
  region: string;
  resources: string[];
  detail: {
    pipeline: string;
    version: number;
    'execution-id': string;
    stage: string;
    action: string;
    state: CodePipelineActionState;
    type: {
      owner: 'AWS' | 'Custom' | 'ThirdParty';
      category: CodePipelineActionCategory;
      provider: 'CodeDeploy';
      version: number;
    };
  };
}

export type CodePipelineEvent =
  | CodePipelinePiplelineEvent
  | CodePipelineStageEvent
  | CodePipelineActionEvent;
