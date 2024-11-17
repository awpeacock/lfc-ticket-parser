import { describe, it, expect, beforeEach } from '@jest/globals';
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBClient, ListTablesCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import * as ICS from 'ics';

import { PersistenceFactory, Client, Backup } from "../persistence";

import setup, { Mocks } from "../setupTests";

setup();

describe('Backing up and restoring ICS data', () => {

    const table: string = 'JESTTABLE';
    const backup: string = 'JESTBACKUP';
    const dbMock = mockClient(DynamoDBClient);
    dbMock.on(ListTablesCommand).resolves({
        TableNames: [ table, backup ]
    });
    const ddbMock = mockClient(DynamoDBDocumentClient);

    const client: Client = PersistenceFactory.getClient(Database.DYNAMODB, table, backup);
    client.init();

    let events: Array<Array<ICS.EventAttributes>> = [];

    beforeEach(() => {
        const bulk: Array<ICS.EventAttributes> = [];
        Mocks.events.bulk.sales.forEach((e) => {
            bulk.push(e);
        });
        const ams: Array<ICS.EventAttributes> = [];
        Mocks.events.ams.sales.forEach((e) => {
            ams.push(e);
        });
        events = [bulk, ams];
    });

    it('should successfully return true/false depending upon success of backing up an ICS file', async () => {
        
        ddbMock.on(PutCommand).resolves({});
        const date: Date = new Date();
        const backup: Backup = new Backup(date, events[0]);
        await expect(client.backup(backup)).resolves.toBe(true);
        expect(ddbMock.commandCalls(PutCommand).length).toBe(1);
        expect(ddbMock.commandCalls(PutCommand).at(0)!.args.at(0)!.input.Item).toStrictEqual({Date: Backup.formatDate(date), Events: backup.toJson(), Attempts: 1});

        ddbMock.on(PutCommand).rejects(new Error('Unable to backup ICS'));
        await expect(client.backup(backup)).resolves.toBe(false);

    });

    it('should successfully return an ICS file if one exists on the DB (and update its attempts)', async () => {
        
        const backup: Backup = new Backup(new Date(), events[0]);
        ddbMock.on(ScanCommand).resolves({
            Items: [
                { 
                    Date: {
                        S: backup.getKey()
                    },
                    Events: {
                        S: JSON.stringify(backup.getEvents())
                    },
                    Attempts: {
                        N: '1'
                    }
                }
            ]
        });
        ddbMock.on(UpdateCommand).resolves({});
        const response: Array<Backup> = await client.restore();
        expect(response.length).toBe(1);
        expect(response[0].getKey()).toEqual(backup.getKey());
        expect(response[0].getEvents()).toEqual(backup.getEvents());
        expect(response[0].isToday()).toBeTruthy();
        expect(response[0].toJson()).toEqual(backup.toJson());
        expect(ddbMock.commandCalls(UpdateCommand).length).toBe(1);
        expect(ddbMock.commandCalls(UpdateCommand).at(0)!.args.at(0)!.input.ExpressionAttributeValues).toStrictEqual({":attempts": 2});
    
    });
        
    it('should return an empty array if no ICS files exist on the DB', async () => {

        ddbMock.on(ScanCommand).resolves({
            Items: undefined
        });
        await expect(client.restore()).resolves.toStrictEqual([]);

    });
        
    it('should successfully handle failures trying to restore an ICS string from the DB', async () => {
        
        ddbMock.on(ScanCommand).rejects(new Error('Unable to restore ICS'));
        await expect(client.restore()).resolves.toStrictEqual([]);

        const backup: Backup = new Backup(new Date(), events[0]);
        ddbMock.on(ScanCommand).resolves({
            Items: [
                { 
                    Date: {
                        S: backup.getKey()
                    },
                    ICS: {
                        S: JSON.stringify(backup.getEvents())
                    },
                    Attempts: {
                        N: '1'
                    }
                }
            ]
        });
        ddbMock.on(UpdateCommand).rejects(new Error('Unable to update ICS'));
        await expect(client.restore()).resolves.toStrictEqual([]);

    });

    it('should successfully return true/false depending upon success of removing ICS backups', async () => {
        
        ddbMock.on(DeleteCommand).resolves({});
        const backup1: Backup = new Backup(new Date(), events[0]);
        const backup2: Backup = new Backup(new Date(), events[1]);
        await expect(client.reset([backup1.getKey(), backup2.getKey()])).resolves.toBe(true);

        ddbMock.on(DeleteCommand).rejects(new Error('Unable to remove backup'));
        await expect(client.reset([backup1.getKey()])).resolves.toBe(false);

    });

    it('should successfully merge backups retrieved from the DB', () => {

        const backup1: Backup = new Backup(new Date(), events[0]);
        const backup2: Backup = new Backup(new Date(), events[1]);
        backup1.merge(backup2);

        expect(backup1.getEvents().length).toBe(9);
        expect(backup1.getEvents().at(0)).toEqual(Mocks.events.bulk.sales.at(0));
        expect(backup1.getEvents().at(7)).toEqual(Mocks.events.ams.sales.at(0));
        
    });

    it('should not merge identical events from backups retrieved from the DB', () => {

        const backup1: Backup = new Backup(new Date(), events[0]);
        expect(backup1.getEvents().length).toBe(7);

        const backup2: Backup = new Backup(new Date(), [events[0][0]]);
        backup1.merge(backup2);
        expect(backup1.getEvents().length).toBe(7);
        
    });

});