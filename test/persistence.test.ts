import { describe, it, expect } from '@jest/globals';

import { FixtureList } from "../src/fixtures";
import { PersistenceFactory, Client } from "../src/persistence";
import setup from "./setup";

setup();

describe('Fixture Persistence', () => {

    const index = new FixtureList();
    index.download();

    it('should successfully initialise the database and backup the fixtures', async () => {

        // If we've not managed to get the DB to be used or the table name, no point continuing
        // - the parser will just have to generate an email every day
        if ( !process.env.DB_CLIENT || !process.env.DB_TABLE ) { 
            return;
        }
        
        expect(() => { index.find() }).not.toThrow();
        const success: boolean = await index.parseAll();
        expect(success).toEqual(true);
        
        const db: Database = process.env.DB_CLIENT as Database;
        const table: string = process.env.DB_TABLE as string;
        
        const client: Client = PersistenceFactory.getClient(db, table + 'Jest');
        await expect(client.init()).resolves.toBe(true);

        for ( const fixture of index.getFixtures() ) {
            await expect(client.sync(fixture)).resolves.toBe(true);
        }

        // As this was purely a DB put up to test the connection and commands,
        // tear it down straight away
        await expect(client.destroy()).resolves.toBe(true);

    }, 30000);

});