import {describe, it, expect, beforeAll, beforeEach} from '@jest/globals';
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { Fixture, FixtureList } from "../src/fixtures";
import { PersistenceFactory, Client } from "../src/persistence";

import setup from "./setup";

setup();

describe('Checking for amendments', () => {

    let index: FixtureList;
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
        index = new FixtureList();
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

    it('should successfully mark the fixture list as changed if one fixture in a list has changed', async () => {

        ddbMock.on(GetCommand).resolvesOnce({
            Item: undefined
        });
        ddbMock.on(PutCommand).resolves({});

        for ( let f = 0; f < fixtures.length; f++ ) {

            ddbMock.on(GetCommand).resolves({
                Item: { 
                    Fixture: fixtures[f].id,
                    Sales: (f == 0) ? null : fixtures[f].getJson()
                },
            });
    
            await expect(client.sync(fixtures[f])).resolves.toBe(true);
            expect(fixtures[f].hasChanged()).toBe(f == 0 ? true : false);

        }
        expect(index.hasChanged()).toBe(true);

    });
    
    it('should successfully mark the fixture list as unchanged if no fixtures in a list have changed', async () => {

        ddbMock.on(PutCommand).resolves({});

        for ( let f = 0; f < index.getFixtures().length; f++ ) {

            ddbMock.on(GetCommand).resolves({
                Item: { 
                    Fixture: fixtures[0].id,
                    Sales: fixtures[f].getJson()
                },
            });

            await expect(client.sync(fixtures[f])).resolves.toBe(true);
            expect(fixtures[f].hasChanged()).toBe(false);

        }
        expect(index.hasChanged()).toBe(false);

    });
    
    it('should throw an error if it is unable to retrieve a fixture due to failure', async () => {

        ddbMock.on(GetCommand).rejects(new Error('Unable to retrieve data'));

        await expect(client.get(fixtures[0])).rejects.toThrow();
        expect(fixtures[0].hasChanged()).toBe(false);

    });

    it('should return false if it is unable to add a fixture to the database', async () => {

        ddbMock.on(PutCommand).rejects(new Error('Unable to store data'));

        await expect(client.put(fixtures[0])).resolves.toBe(false);
        expect(fixtures[0].hasChanged()).toBe(false);

    });

    it('should return false if it is unable to update a fixture to the database', async () => {

        ddbMock.on(UpdateCommand).rejects(new Error('Unable to update data'));

        await expect(client.update(fixtures[0])).resolves.toBe(false);
        expect(fixtures[0].hasChanged()).toBe(false);

    });

    it('should return false if it is unable to sync a fixture for any reason', async () => {

        ddbMock.on(GetCommand).resolves({
            Item: undefined
        });
        ddbMock.on(PutCommand).rejects(new Error('Unable to store data'));

        await expect(client.sync(fixtures[0])).resolves.toBe(false);
        expect(fixtures[0].hasChanged()).toBe(false);

        const json: string = fixtures[3]!.getJson()!.replace(/,\{"description".+?"\}/, '');
        ddbMock.on(GetCommand).resolves({
            Item: { 
                Fixture: fixtures[3].id,
                Sales: json
            },
        });
        ddbMock.on(UpdateCommand).rejects(new Error('Unable to update data'));

        await expect(client.sync(fixtures[3])).resolves.toBe(false);
        expect(fixtures[0].hasChanged()).toBe(false);

        ddbMock.on(GetCommand).rejects(new Error('Unable to retrieve data'));

        await expect(client.sync(fixtures[0])).resolves.toBe(false);
        expect(fixtures[0].hasChanged()).toBe(false);

    });

});