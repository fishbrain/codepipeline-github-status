import { Octokit } from '@octokit/rest';
import { Callback, Context, Handler } from 'aws-lambda';
import * as AWS from 'aws-sdk';

import { CodePipelineEvent } from './codepipeline';
import { fetchParameters, getParameter } from './ssm';

const JSON_INDENT = 2;

export const handler: Handler = async (
  event: CodePipelineEvent,
  _context: Context,
  _callback: Callback | undefined,
) => {
  const parameters = await fetchParameters();

  const githubToken = getParameter(parameters, 'github_token');

  if (githubToken === undefined) {
    console.log('No github_token specified');
    return;
  }

  const octokit = new Octokit({ auth: githubToken });

  const codePipeline = new AWS.CodePipeline();
  const execution = await codePipeline
    .getPipelineExecution({
      pipelineExecutionId: event.detail['execution-id'],
      pipelineName: event.detail.pipeline,
    })
    .promise();

  if (execution.pipelineExecution == null) {
    console.log(
      'Failed to fetch pipeline execution',
      JSON.stringify(execution, null, JSON_INDENT),
    );
    return;
  }

  if (
    execution.pipelineExecution.artifactRevisions == null ||
    execution.pipelineExecution.artifactRevisions.length === 0
  ) {
    console.log('No revision info found in pipeline execution');
    console.log(JSON.stringify(execution, null, JSON_INDENT));
    return;
  }

  const sha = execution.pipelineExecution.artifactRevisions[0].revisionId;
  if (sha == null) {
    console.log('No revisionId found in pipeline execution');
    return;
  }

  const { revisionUrl } = execution.pipelineExecution.artifactRevisions[0];
  if (revisionUrl == null) {
    console.log(
      'No revisionUrl found in pipeline execution',
      JSON.stringify(execution, null, JSON_INDENT),
    );
    return;
  }

  const matches =
    revisionUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+).*/) ||
    revisionUrl.match(
      /^https:\/\/.*\.console\.aws\.amazon\.com\/.*FullRepositoryId=([^/]+)\/([^&]+).*/,
    );
  if (matches == null) {
    console.log(`Not a GitHub revisionUrl: ${revisionUrl}`);
    return;
  }
  const owner = matches[1];
  const repo = matches[2];

  const state = ((
    pipelineExecution: AWS.CodePipeline.PipelineExecution,
  ): 'error' | 'failure' | 'pending' | 'success' => {
    switch (pipelineExecution.status) {
      case 'InProgress':
        return 'pending';
      case 'Failed':
        return 'failure';
      case 'Succeeded':
        return 'success';
      default:
        return 'error';
    }
  })(execution.pipelineExecution);

  const description = ((): string => {
    switch (event['detail-type']) {
      case 'CodePipeline Pipeline Execution State Change':
        return `${execution.pipelineExecution.status}: Execution ${event.detail['execution-id']}`;
      case 'CodePipeline Action Execution State Change':
      case 'CodePipeline Stage Execution State Change':
        return `${execution.pipelineExecution.status} (${event.detail.stage}): Execution ${event.detail['execution-id']}`;
      default:
        throw new Error('Unknown event type');
    }
  })();

  await octokit.repos.createCommitStatus({
    description,
    owner,
    repo,
    sha,
    state,
    context: `CodePipeline (${event.detail.pipeline})`,
    target_url: `https://${event.region}.console.aws.amazon.com/codesuite/codepipeline/pipelines/${event.detail.pipeline}/executions/${event.detail['execution-id']}/visualization?region=${event.region}`,
  });
};
