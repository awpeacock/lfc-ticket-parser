import { DynamoDBClient, ListTablesCommand, ListTablesCommandOutput, CreateTableCommand, DeleteTableCommand, ScanCommand, BillingMode, waitUntilTableExists } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

import Fixture from "../fixtures/fixture";
import Client from "./client";
import Backup from "./backup";
  
/**
 * Class representing a DynamoDB client, to persist and retrieve data on fixtures and sales
 * dates, in order to determine if data has changed since the last run of the parser (thus 
 * preventing unnecessary spamming of the same ICS entries.
 */
export default class DynamoDB extends Client {

    private client: DynamoDBClient = new DynamoDBClient({});
    private docClient: DynamoDBDocumentClient = DynamoDBDocumentClient.from(this.client);

    async init(): Promise<boolean> {
        
        try {
            const list: ListTablesCommand = new ListTablesCommand({});
            const response: ListTablesCommandOutput = await this.client.send(list);
            if ( !response.TableNames?.includes(this.tables.fixtures) ) {
                const command = new CreateTableCommand({
                    TableName: this.tables.fixtures,
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
                await this.client.send(command);
                await waitUntilTableExists({ client: this.client, maxWaitTime: 30 }, { TableName: this.tables.fixtures });
            }
            if ( !response.TableNames?.includes(this.tables.backup) ) {
                const command = new CreateTableCommand({
                    TableName: this.tables.backup,
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
                await this.client.send(command);
                await waitUntilTableExists({ client: this.client, maxWaitTime: 30 }, { TableName: this.tables.backup });
            }
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }

    }

    async destroy(): Promise<boolean> {
        
        try {
            const list: ListTablesCommand = new ListTablesCommand({});
            const response: ListTablesCommandOutput = await this.client.send(list);
            if ( response.TableNames?.includes(this.tables.fixtures) ) {
                const command = new DeleteTableCommand({
                    TableName: this.tables.fixtures
                });
                await this.client.send(command);
            }
            if ( response.TableNames?.includes(this.tables.backup) ) {
                const command = new DeleteTableCommand({
                    TableName: this.tables.backup
                });
                await this.client.send(command);
            }
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }

    }

    async get(fixture: Fixture): Promise<Nullable<string>> {
        
        const get = new GetCommand({
            TableName: this.tables.fixtures,
            Key: {
                Fixture: fixture.id
            },
            ConsistentRead: true,
        });
        const response = await this.docClient.send(get);
        if ( response == null ) {
            return null;
        }
        if ( response.Item != null ) {
            const json: string = response.Item.Sales;
            return json;
        }
        return null;

    }

    async put(fixture: Fixture): Promise<boolean> {

        try {
            const put = new PutCommand({
                TableName: this.tables.fixtures,
                Item: {
                    Fixture: fixture.id,
                    Sales: fixture.getJson()
                }
            });
            await this.docClient.send(put);
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }

    }

    async update(fixture: Fixture): Promise<boolean> {

        try {
            const update = new UpdateCommand({
                TableName: this.tables.fixtures,
                Key: { 
                    Fixture: fixture.id 
                },
                UpdateExpression: 'SET Sales = :json',
                ExpressionAttributeValues: {
                    ':json': fixture.getJson(),
                },
                ReturnValues: "ALL_NEW",
            });
            await this.docClient.send(update);
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }

    }

    async sync(fixture: Fixture): Promise<boolean> {

        // First, check if the fixture exists
        let existing: Nullable<string>;
        try {
            existing = await this.get(fixture);
        } catch (e) {
            console.error(e);
            // Always set as changed if we can't retrieve it, best to work on
            // theory of sending emails when we shouldn't is better than not
            // when we should and potentially missing a sale.
            fixture.setChanged(true);
            return false;
        }
        if ( existing == null ) {

            // If it doesn't exist, then it's a simple job of adding the fixture
            // to the database, and marking as changed, (if there's actually any 
            // sales dates of course).
            if ( fixture.getActiveSaleCount() > 0 ) {
                fixture.setChanged(true);
                const success: boolean = await this.put(fixture);
                if ( !success ) {
                    return false;
                }
            } else {
                fixture.setChanged(false);
            }

        } else {

            // Otherwise, if it does exist, compare the JSON stored on the DB with the JSON.  If no match, 
            // first check whether any details on the sales have changed or if it's just a multi-day sale
            // and the first days have passed.  If the former, then update the DB.
            if ( !fixture.equals(existing) ) {
                fixture.setChanged(true);
                const success: boolean = await this.update(fixture);
                if ( !success ) {
                    return false;
                }
            } else {
                fixture.setChanged(false);
            }

        }
        return true;

    }

    async backup(events: Backup): Promise<boolean> {

        const date: string = Backup.formatDate(new Date());
        try {
            const put = new PutCommand({
                TableName: this.tables.backup,
                Item: {
                    Date: date,
                    Events: events.toJson(),
                    Attempts: 1
                }
            });
            await this.docClient.send(put);
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }

    }

    async restore(): Promise<Array<Backup>> {

        const backups: Array<Backup> = new Array<Backup>();
        try {
            const scan = new ScanCommand({
                TableName: this.tables.backup,
                ConsistentRead: true,
            });
            const response = await this.docClient.send(scan);
            if ( response != null && response.Items != null ) {
                for ( let b = 0; b < response.Items.length; b++ ) {

                    const date: string = response.Items[b].Date.S!;
                    const json: string = response.Items[b].Events.S!;
                    const attempts: number = parseInt(response.Items[b].Attempts.N!);
                    backups.push(Backup.fromJson(Backup.parseDate(date), json));

                    const update = new UpdateCommand({
                        TableName: this.tables.backup,
                        Key: { 
                            Date: date
                        },
                        UpdateExpression: 'SET Attempts = :attempts',
                        ExpressionAttributeValues: {
                            ':attempts': (attempts+1),
                        },
                        ReturnValues: "ALL_NEW",
                    });
                    await this.docClient.send(update);
                }
                return backups;
            }
        } catch (e) {
            console.error('Error attempting to restore backups - ' + e);
            return [];
        }
        return [];

    }

    async reset(dates: Array<string>): Promise<boolean> {
        
        try {
            for ( let d = 0; d < dates.length; d++ ) {
                const remove = new DeleteCommand({
                    TableName: this.tables.backup,
                    Key: {
                        Date: dates[d]
                    }
                });
                await this.docClient.send(remove);
            }
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }

    }

}