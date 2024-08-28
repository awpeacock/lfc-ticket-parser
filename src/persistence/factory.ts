import Client from "./client";
import DynamoDB from "./dynamo";

/**
 * Factory class from which to retrieve the database client to store fixture details.
 */
export default class PersistenceFactory {

    /**
     * Returns a Client from the parameters provided.
     * @param {Database} db - The type of database to be used.
     * @param {string} table - The database table to contain the fixtures.
     * @returns {Client} An initialised Client class with all methods to persist/retrieve fixtures.
     */
    static getClient(db: Database, table: string): Client {

        switch ( db ) {
            case Database.DYNAMODB: {
                return new DynamoDB(table);
            }
        }

    }

}