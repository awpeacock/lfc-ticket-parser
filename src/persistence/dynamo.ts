import { DynamoDBClient, ListTablesCommand, ListTablesCommandOutput, CreateTableCommand, BillingMode, waitUntilTableExists, DeleteTableCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import Fixture from "../fixtures/fixture";
import Client from "./client";
  
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
            if ( !response.TableNames?.includes(this.table) ) {
                const command = new CreateTableCommand({
                    TableName: this.table,
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
                await waitUntilTableExists({ client: this.client, maxWaitTime: 30 }, { TableName: this.table });
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
            if ( response.TableNames?.includes(this.table) ) {
                const command = new DeleteTableCommand({
                    TableName: this.table
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
        
        try {
            const get = new GetCommand({
                TableName: this.table,
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
        } catch (e) {
            console.error(e);
            return null;
        }

    }

    async put(fixture: Fixture): Promise<boolean> {

        try {
            const put = new PutCommand({
                TableName: this.table,
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
                TableName: this.table,
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
        const existing: Nullable<string> = await this.get(fixture);
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

            // Otherwise, if it does exist, it's also a relatively straightforward job -
            // compare the JSON stored on the DB with the JSON.  If no match, it's changed
            // and update the DB.
            if ( fixture.getJson() != existing ) {
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

}