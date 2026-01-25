import { describe, it, expect } from '@jest/globals';
import { mockClient } from "aws-sdk-client-mock";
import { DescribeTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';

import { FixtureList } from "../fixtures";
import { PersistenceFactory, Client } from "../persistence";
import setup from "../setupTests";

setup();

describe('Fixture Persistence', () => {

    const index = new FixtureList();
    index.download();

    it('should successfully verify the databases exist', async () => {

        // If we've not managed to get the DB to be used or the table name, no point continuing
        // - the parser will just have to generate an email every day
        if ( !process.env.DB_CLIENT || !process.env.DB_TABLE || !process.env.DB_BACKUP ) { 
            return;
        }
        
        expect(() => { index.find() }).not.toThrow();
        const success: boolean = await index.parseAll();
        expect(success).toEqual(true);

        const dbMock = mockClient(DynamoDBClient);
        
        const db: Database = process.env.DB_CLIENT as Database;
        const featuresTable: string = process.env.DB_TABLE as string;
        const backupTable: string = process.env.DB_BACKUP as string;
        
        const client: Client = PersistenceFactory.getClient(db, featuresTable + 'Jest', backupTable + 'Jest');
        dbMock.on(DescribeTableCommand).resolves({
            Table: {
                TableName: featuresTable,
                TableStatus: 'ACTIVE',
                AttributeDefinitions: [
                {
                    AttributeName: 'Fixture',
                    AttributeType: 'S',
                },
                ],
                KeySchema: [
                {
                    AttributeName: 'Fixture',
                    KeyType: 'HASH',
                },
                ],
                BillingModeSummary: {
                BillingMode: 'PAY_PER_REQUEST',
                },
            },
            $metadata: {
                httpStatusCode: 200,
                requestId: 'test-request-id',
            },
        });
        await expect(client.init()).resolves.toBe(true);
    }, 60000);

    it('should return false if it cannot find the databases', async () => {

        const dbMock = mockClient(DynamoDBClient);
        const e = new Error('Could not find table');
        e.name = 'ResourceNotFoundException';
        dbMock.on(DescribeTableCommand).rejects(e);

        const client: Client = PersistenceFactory.getClient(Database.DYNAMODB, 'JestFailure', 'JestBackupFailure');
        await expect(client.init()).resolves.toBe(false);

    });

    it('should return false if an unknown error prevents initialision of the database', async () => {

        const dbMock = mockClient(DynamoDBClient);
        dbMock.on(DescribeTableCommand).rejects(new Error('Could not describe table'));

        const client: Client = PersistenceFactory.getClient(Database.DYNAMODB, 'JestFailure', 'JestBackupFailure');
        await expect(client.init()).resolves.toBe(false);

    });

});