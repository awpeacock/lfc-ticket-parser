import {
	CloudFormationClient,
	CreateStackCommand,
	UpdateStackCommand,
	waitUntilStackCreateComplete,
	waitUntilStackUpdateComplete,
} from '@aws-sdk/client-cloudformation';
import type {
	CreateStackCommandInput,
	Parameter,
    UpdateStackCommandInput,
} from '@aws-sdk/client-cloudformation';
import {
	S3Client,
	PutObjectCommand,
    ListObjectVersionsCommand,
    DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import dotenv from 'dotenv';
import fs from 'node:fs';

import { Narrator } from '@redpenguinstudio/herbert';

import { Constants } from '../src/constants';

import pkg from '../package.json' assert { type: 'json' };

dotenv.config({ debug: false, quiet: true });

const deploy = async (
	client: CloudFormationClient,
	stack: string,
	input: CreateStackCommandInput,
): Promise<void> => {
	try {
		let create = true;
		await client.send(new CreateStackCommand(input)).catch(async (e) => {
			if (e.name === 'AlreadyExistsException') {
                Narrator.log('Stack exists, updating...');
                create = false;
                await client.send(new UpdateStackCommand(input));
			} else {
				throw e;
			}
		});
		Narrator.success('Deployment initiated');
        if (create) {
            await waitUntilStackCreateComplete(
                { client: client, maxWaitTime: 1800 },
                { StackName: stack },
            );
        } else {
            await waitUntilStackUpdateComplete(
                { client: client, maxWaitTime: 1800 },
                { StackName: stack },
            );
        }
		Narrator.success('Deployment completed');
	} catch (e) {
		const err = e as Error;
		if (err.message.includes('No updates are to be performed')) {
			Narrator.log('No updates were required');
		} else {
			Narrator.error('Deployment failed', e as Error);
            process.exit(1);
		}
	}
};

const getAccountId = async (sts: STSClient) => {
	const identity = await sts.send(new GetCallerIdentityCommand({}));
	return identity.Account;
};

const upload = async (s3: S3Client, bucket: string): Promise<string> => {
    const body = fs.readFileSync('./outputs/lfct-aws-js.zip');
    const output = await s3.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: 'lfct-aws-js.zip',
            Body: body,
        }),
    );
    if (!output.VersionId) {
        Narrator.error('Unable to retrieve version ID for S3 upload');
        process.exit(1);
    }
    return output.VersionId;
};

const empty = async (s3: S3Client, bucket: string) => {
    const versions = await s3.send(new ListObjectVersionsCommand({ Bucket: bucket }));
    const objects = [];
    if (versions.Versions) {
        for (const v of versions.Versions) {
            objects.push({ Key: v.Key!, VersionId: v.VersionId! });
        }
    }
    if (versions.DeleteMarkers) {
        for (const d of versions.DeleteMarkers) {
            objects.push({ Key: d.Key!, VersionId: d.VersionId! });
        }
    }
    if (objects.length > 0) {
        await s3.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: objects },
        }));
    }
};

const verifySSMParameter = async (
    client: SSMClient,
    environment: string,
    key: string
): Promise<boolean> => {
    try {
        await client.send(
            new GetParameterCommand({ Name: '/lfct/' + environment.toLowerCase() + '/' + key })
        );
        Narrator.info('SSM parameter for "' + key + '" exists');
        return true;
    } catch (e) {
        if ((e as Error).name !== "ParameterNotFound") {
            Narrator.error('Unable to retrieve secrets from SSM store', e as Error);
            process.exit(1);
        }
        Narrator.info('SSM parameter for "' + key + '" does NOT exist');
        return false;
    }
}

const setSSMParameters = async (
    client: SSMClient,
    environment: string,
    parameters: Array<string>
): Promise<void> => {
    for (const key of parameters) {
        const value = process.env[key];
        if (value && value.trim() !== '') {
            try {
                const current = await client.send(
                    new GetParameterCommand({ Name: '/lfct/' + environment.toLowerCase() + '/' + key, WithDecryption: true })
                );
                if (current.Parameter?.Type === 'SecureString' && current.Parameter?.Value === value) {
                    Narrator.info('Ignoring "' + key + '" - no change to existing value');
                    continue;
                }
            } catch (e) {
                if ((e as Error).name !== "ParameterNotFound") {
                    Narrator.error('Unable to retrieve secrets from SSM store', e as Error);
                    process.exit(1);
                }
            }
            Narrator.log('Setting secret for "' + key + '"');
            const output = await client.send(
                new PutParameterCommand({
                    Name: '/lfct/' + environment.toLowerCase() + '/' + key,
                    Value: process.env[key]!,
                    Type: 'SecureString',
                    Overwrite: true
                })
            );
            Narrator.success('Updated "' + key + '" to version ' + output.Version);
        } else {
            Narrator.warn('Ignoring "' + key + '" - no value provided');
        }
    }
}

const run = async () => {
    Narrator.title('Setting up AWS Lambda, DynamoDB and SSM');

    const template = fs.readFileSync('./deploy/cloudformation.yaml', 'utf8');

    const environment: string = process.env.ENVIRONMENT || Constants.ENV_DEV;

    const config = {
        region: process.env.AWS_REGION,
        stack: 'LFC-Ticket-Parser-' + environment + '-Stack',
        environment: environment,
    };

    const variables: Record<string, string> = {
        Environment: 'ENVIRONMENT',
        LFCDomain: 'DOMAIN',
        LFCPath: 'INDEX_URL',
        DatabaseClient: 'DB_CLIENT',
        DynamoDBSalesTableName: 'DB_TABLE',
        DynamoDBBackupTableName: 'DB_BACKUP',
        EmailPort: 'EMAIL_PORT',
        EmailSecure: 'EMAIL_SECURE',
        EmailFrom: 'EMAIL_FROM',
    };
    const secrets: Record<string, string> = {
        EmailHost: 'EMAIL_HOST',
        EmailUser: 'EMAIL_USER',
        EmailPassword: 'EMAIL_PASS',
        EmailTo: 'EMAIL_TO',
        EmailError: 'EMAIL_ERROR',
    };
    const parameters: Array<string> = [];

    if (!config.region || !config.stack || !variables.EmailFrom || !secrets.EmailHost || !secrets.EmailUser || !secrets.EmailPassword || !secrets.EmailTo) {
        Narrator.error('Missing environment variables. Check .env or GitHub secrets.');
        process.exit(1);
    }

    const cf = new CloudFormationClient({ region: config.region });
    const ssm = new SSMClient({ region: config.region });
    const sts = new STSClient({ region: config.region });
    const s3 = new S3Client({ region: config.region });

    const params: Array<Parameter> = [];
    for (const key in variables) {
        const value = process.env[variables[key]];
        if (value && value.trim() !== '') {
            params.push({
                ParameterKey: key,
                ParameterValue: value
            });
        }
    }

    Narrator.info(`Environment: ${config.environment}`);
    Narrator.info(`AWS Region: ${config.region}`);
    Narrator.info(`AWS Stack Name: ${config.stack}`);
    if (process.env.DOMAIN) {
        Narrator.info(`LFC Domain Name: ${process.env.DOMAIN}`);
    }
    if (process.env.INDEX_URL) {
        Narrator.info(`LFC Path: ${process.env.INDEX_URL}`);
    }

    try {
        if (environment !== Constants.ENV_DEV) {
            Narrator.heading('Verifying existence of secrets');
            for (const key in secrets) {
                let exists = await verifySSMParameter(ssm, config.environment!, secrets[key]);
                // Don't set the secret for error if we haven't passed it (it's the only optional one)
                if (key === 'EmailError' && !process.env.EMAIL_ERROR) {
                    exists = true;
                }
                if (!exists) {
                    parameters.push(secrets[key]);
                }
            }
        }

        Narrator.heading('Initial deployment of stack (minus Lambda code)');
        const input: CreateStackCommandInput = {
            StackName: config.stack,
            TemplateBody: template,
            Capabilities: ['CAPABILITY_NAMED_IAM'],
            Parameters: params,
        };
        await deploy(cf, config.stack!, input);

        if (environment !== Constants.ENV_DEV) {
            if (parameters.length > 0) {
                Narrator.heading('Creating/updating secrets');
                await setSSMParameters(ssm, config.environment!, parameters);
            }

            Narrator.heading('Uploading Lambda code to S3 bucket');
            const accountId = await getAccountId(sts);
            const bucket = 'lfct-code-' + config.environment.toLowerCase() + '-' + accountId;
            Narrator.info(`S3 Bucket Name: ${bucket}`);

            Narrator.log('Uploading new build...');
            const version = await upload(s3, bucket);
            Narrator.success('S3 bucket successfully updated');

            Narrator.heading('Redeploying stack with Lambda code');
            params.push({
                ParameterKey: 'AppVersion',
                ParameterValue: pkg.version,
            });
            params.push({
                ParameterKey: 'S3Version',
                ParameterValue: version,
            });
            const update: UpdateStackCommandInput = {
                StackName: config.stack,
                TemplateBody: template,
                Capabilities: ['CAPABILITY_NAMED_IAM'],
                Parameters: params,
            };
            await deploy(cf, config.stack!, update);

            // Now tidy up the zip upload (not needed any more and means we can clean up the stack if need be)
            Narrator.heading('Post-install tidy up');
            Narrator.log('Emptying S3 bucket...');
            await empty(s3, bucket);
            Narrator.success('S3 bucket successfully emptied');
        }
    } catch (e) {
        Narrator.error('Failed to deploy', e as Error);
        process.exit(1);
    }
};

run();