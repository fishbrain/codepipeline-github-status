import * as AWS from 'aws-sdk';

// Get the value of a single parameter or undefined if not found
export const getParameter = (
  parameters: AWS.SSM.Parameter[],
  name: string,
): string | undefined => {
  const val = parameters.find(
    (p) => p.Name !== undefined && p.Name.endsWith(`/${name}`),
  );
  if (val && val.Value) {
    return val.Value;
  }
  return undefined;
};

export const fetchParameters = async (): Promise<AWS.SSM.Parameter[]> => {
  const ssm = new AWS.SSM();
  const parameters = (
    await ssm
      .getParametersByPath({
        Path: `/codepipeline-github-status`,
        WithDecryption: true,
      })
      .promise()
  ).Parameters;

  if (parameters === undefined) {
    throw new Error('Could not fetch parameters');
  }

  return parameters;
};
