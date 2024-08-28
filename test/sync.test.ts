import {describe, it, expect, beforeAll, beforeEach} from '@jest/globals';
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { Fixture, FixtureList } from "../src/fixtures";
import { PersistenceFactory, Client } from "../src/persistence";

import setup from "./setup";

setup();

describe('Checking for amendments', () => {

    const index: FixtureList = new FixtureList();
    let fixtures: Array<Fixture> = [];

    const table: string = 'JESTTABLE';
    const dbMock = mockClient(DynamoDBClient);
    dbMock.on(ListTablesCommand).resolves({
        TableNames: [ table ]
    });
    const ddbMock = mockClient(DynamoDBDocumentClient);

    const client: Client = PersistenceFactory.getClient(Database.DYNAMODB, table);
    client.init();

    beforeAll(async () => {
        await index.download();
        expect(() => { index.find() }).not.toThrow();
        const success: boolean = await index.parseAll();
        expect(success).toEqual(true);
        fixtures = index.getFixtures();
    });

    beforeEach(() => {
        ddbMock.reset();
    });

    it('should successfully add a new fixture to the DB and mark as changed', async () => {

        ddbMock.on(GetCommand).resolves({
            Item: undefined
        });
        ddbMock.on(PutCommand).resolves({});

        await expect(client.sync(fixtures[0])).resolves.toBe(true);
        expect(fixtures[0].hasChanged()).toBe(true);

    });

    it('should successfully recognise an existing, unchanged fixture, not add to the DB and mark as unchanged', async () => {

        ddbMock.on(GetCommand).resolves({
            Item: { 
                Fixture: fixtures[0].id,
                Sales: fixtures[0].getJson()
            },
        });
        await expect(client.sync(fixtures[0])).resolves.toBe(true);
        expect(fixtures[0].hasChanged()).toBe(false);

    });

    it('should successfully ignore a fixture that has no active sales, not even check the DB and mark as unchanged', async () => {

        await expect(client.sync(fixtures[1])).resolves.toBe(true);
        expect(fixtures[1].hasChanged()).toBe(false);

    });
    
    it('should successfully recognise an existing fixture with a revised sales date, add to the DB and mark as changed', async () => {

        const json: string = fixtures[3]!.getJson()!.replace(/,\{"description".+?"\}/, '');
        ddbMock.on(GetCommand).resolves({
            Item: { 
                Fixture: fixtures[3].id,
                Sales: json
            },
        });
        ddbMock.on(UpdateCommand).resolves({});
        await expect(client.sync(fixtures[3])).resolves.toBe(true);
        expect(fixtures[3].hasChanged()).toBe(true);

    });
    
});