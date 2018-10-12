import { Handler, Context, Callback } from 'aws-lambda';
import * as Octokit from '@octokit/rest';
import * as AWS from 'aws-sdk';
import { getParameter, fetchParameters } from './ssm';
import { CodePipelineEvent } from './codepipeline';

export const handler: Handler = async (
  event: CodePipelineEvent,
  _context: Context,
  _callback: Callback | undefined,
) => {
  const parameters = await fetchParameters();
  const octokit = new Octokit();

  const githubToken = getParameter(parameters, 'github_token');

  if (githubToken === undefined) {
    console.log('No github_token specified');
    return;
  }

  octokit.authenticate({
    type: 'token',
    token: githubToken,
  });

  const codePipeline = new AWS.CodePipeline();
  const execution = await codePipeline
    .getPipelineExecution({
      pipelineName: event.detail.pipeline,
      pipelineExecutionId: event.detail['execution-id'],
    })
    .promise();

  if (execution.pipelineExecution == null) {
    console.log(
      'Failed to fetch pipeline execution',
      JSON.stringify(execution, null, 2),
    );
    return;
  }

  if (
    execution.pipelineExecution.artifactRevisions == null ||
    execution.pipelineExecution.artifactRevisions.length === 0
  ) {
    console.log('No revision info found in pipeline execution');
    return;
  }

  const sha = execution.pipelineExecution.artifactRevisions[0].revisionId;
  if (sha == null) {
    console.log(
      'No revisionId found in pipeline execution',
      JSON.stringify(execution, null, 2),
    );
    return;
  }

  const revisionUrl =
    execution.pipelineExecution.artifactRevisions[0].revisionUrl;
  if (revisionUrl == null) {
    console.log(
      'No revisionUrl found in pipeline execution',
      JSON.stringify(execution, null, 2),
    );
    return;
  }

  const matches = revisionUrl.match(
    /^https:\/\/github\.com\/([^\/]+)\/([^\/]+).*/,
  );
  if (matches == null) {
    console.log(`Not a GitHub revisionUrl: ${revisionUrl}`);
    return;
  }
  const owner = matches[1];
  const repo = matches[2];

  const state = ((
    execution: AWS.CodePipeline.PipelineExecution,
  ): 'error' | 'failure' | 'pending' | 'success' => {
    switch (execution.status) {
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

  const description = ((event: CodePipelineEvent): string => {
    switch (event['detail-type']) {
      case 'CodePipeline Pipeline Execution State Change':
        return `${execution.pipelineExecution.status}: Execution ${
          event.detail['execution-id']
        }`;
      case 'CodePipeline Action Execution State Change':
      case 'CodePipeline Stage Execution State Change':
        return `${execution.pipelineExecution.status} (${
          event.detail.stage
        }): Execution ${event.detail['execution-id']}`;
    }
  })(event);

  await octokit.repos.createStatus({
    sha,
    state,
    owner,
    repo,
    description,
    context: `CodePipeline (${event.detail.pipeline})`,
    target_url: `https://${
      event.region
    }.console.aws.amazon.com/codepipeline/home?region=${event.region}#/view/${
      event.detail.pipeline
    }/history`,
  });
};
