import { DynamoDBClient, ListTablesCommand, ListTablesCommandOutput, CreateTableCommand, DeleteTableCommand, BillingMode, waitUntilTableExists, waitUntilTableNotExists } from "@aws-sdk/client-dynamodb";
import dotenv from 'dotenv';

import { Narrator } from '@redpenguinstudio/herbert';

import { Constants } from '../src/constants';

interface TableTypes {
    fixtures: string;
    backup: string;
} 

const init = async(client: DynamoDBClient, tables: TableTypes): Promise<boolean> => {
    
    try {
        const list: ListTablesCommand = new ListTablesCommand({});
        const response: ListTablesCommandOutput = await client.send(list);
        if ( !response.TableNames?.includes(tables.fixtures) ) {
            const command = new CreateTableCommand({
                TableName: tables.fixtures,
                BillingMode: BillingMode.PROVISIONED,
                ProvisionedThroughput: {
                    ReadCapacityUnits: 1,
                    WriteCapacityUnits: 1
                },
                AttributeDefinitions: [
                    { 
                        AttributeName: "Fixture", 
                        AttributeType: "S" 
                    }
                ],
                KeySchema: [
                    { 
                        AttributeName: "Fixture", 
                        KeyType: "HASH" 
                    }
                ]
            });
            await client.send(command);
            await waitUntilTableExists({ client: client, maxWaitTime: 30 }, { TableName: tables.fixtures });
        }
        if ( !response.TableNames?.includes(tables.backup) ) {
            const command = new CreateTableCommand({
                TableName: tables.backup,
                BillingMode: BillingMode.PROVISIONED,
                ProvisionedThroughput: {
                    ReadCapacityUnits: 1,
                    WriteCapacityUnits: 1
                },
                AttributeDefinitions: [
                    { 
                        AttributeName: "Date", 
                        AttributeType: "S" 
                    }
                ],
                KeySchema: [
                    { 
                        AttributeName: "Date", 
                        KeyType: "HASH" 
                    }
                ]
            });
            await client.send(command);
            await waitUntilTableExists({ client: client, maxWaitTime: 30 }, { TableName: tables.backup });
        }
        Narrator.success('DynamoDB tables successfully created');
        return true;
    } catch (e) {
        Narrator.error('Unexpected error initialising DynamoDB', e as Error);
        return false;
    }

}

const destroy = async (client: DynamoDBClient, tables: TableTypes): Promise<boolean> => {
    
    try {
        const list: ListTablesCommand = new ListTablesCommand({});
        const response: ListTablesCommandOutput = await client.send(list);
        if ( response.TableNames?.includes(tables.fixtures) ) {
            const command = new DeleteTableCommand({
                TableName: tables.fixtures
            });
            await client.send(command);
            await waitUntilTableNotExists({ client: client, maxWaitTime: 30 }, { TableName: tables.fixtures });
        }
        if ( response.TableNames?.includes(tables.backup) ) {
            const command = new DeleteTableCommand({
                TableName: tables.backup
            });
            await client.send(command);
            await waitUntilTableNotExists({ client: client, maxWaitTime: 30 }, { TableName: tables.backup });
        }
        Narrator.success('DynamoDB tables successfully deleted (if they existed)');
        return true;
    } catch (e) {
        Narrator.error('Unexpected error trying to delete DynamoDB tables', e as Error);
        return false;
    }

}

const run = async () => {

    dotenv.config({ debug: false, quiet: true });

    const arg = process.argv.find((a) => a.startsWith('-action'));
    const action = arg?.split('=')[1] || 'create';

    const fixtures: string = process.env.DB_TABLE || Constants.TABLE_SALES;
    const backup: string = process.env.DB_BACKUP || Constants.TABLE_BACKUP;
    const environment: string = process.env.ENVIRONMENT || Constants.ENV_DEV;

    const tables: TableTypes = {fixtures: fixtures + '-' + environment, backup: backup + '-' + environment};

    const client: DynamoDBClient = new DynamoDBClient({});
    if (action === 'create') {
        init(client, tables);
    } else if (action === 'destroy') {
        destroy(client, tables);
    }

};

run();