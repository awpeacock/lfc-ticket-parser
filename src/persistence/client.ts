import Fixture from "../fixtures/fixture";

/**
 * Abstract class which all database clients must extend, containing all methods needed
 * to persist fixtures and sales dates, in order to determine if data has changed since the
 * last run of the parser (thus preventing unnecessary spamming of the same ICS entries.
 */
export default abstract class Client {

    /** The name of the table on which to write fixture details. */
    protected table: string;

    /**
     * Creates a Client from the parameters provided.
     * @param {string} table - The database table to contain the fixtures.
     */
    constructor(table: string) {
        this.table = table;
    }

    /**
     * Initialises the client - if this is the first time the parser has
     * run, it will automatically create the table to store fixture data.
     * This should not throw any errors but, rather, will handle any 
     * errors and just return false.
     * @return {Promise<boolean>} A boolean indicating the success, or otherwise, of the operation.
     */
    abstract init(): Promise<boolean>;

    /**
     * Deletes the table storing fixture data.  This should not throw any errors but, rather, will handle any 
     * errors and just return false.
     * @return {Promise<boolean>} A boolean indicating the success, or otherwise, of the operation.
     */
    abstract destroy(): Promise<boolean>;

    /**
     * Searches the database for the fixture provided (by the key created by the Fixture class),
     * and returns the JSON string containing all sales if it is found.
     * This should not throw any errors but, rather, will handle any 
     * errors and just return null, as if the fixture wasn't found.
     * @param {Fixture} fixture - The fixture to be retreieved from the database.
     * @return {Promise<Nullable<string>>} The JSON stored on the DB for the fixture (if present), otherwise null.
     */
    abstract get(fixture: Fixture): Promise<Nullable<string>>;

    /**
     * Stores a fixture on the database using the key created by the Fixture class and the JSON
     * representing all sales dates.  This should not throw any errors but, rather, will handle any 
     * errors and just return false.
     * @param {Fixture} fixture - The fixture to be stored on the database.
     * @return {Promise<boolean>} A boolean indicating the success, or otherwise, of the operation.
     */
    abstract put(fixture: Fixture): Promise<boolean>;

    /**
     * Updates the JSON representing all sales dates for an existing fixture on the database using 
     * the key created by the Fixture class.  This should not throw any errors but, rather, will handle any 
     * errors and just return false.
     * @param {Fixture} fixture - The fixture to be updated on the database.
     * @return {Promise<boolean>} A boolean indicating the success, or otherwise, of the operation.
     */
    abstract update(fixture: Fixture): Promise<boolean>;

    /**
     * Searches the database for the fixture provided via the key created by the Fixture class.  If
     * found, it will check to see for any changes to the JSON and update it if any found.  If it doesn't
     * find an entry, it will create a new one for the fixture.  It will never attempt to update a
     * fixture if there are no active sales dates (and will never mark it as changed).
     * Any time this method updates the database, it will update the fixture to flag that it has been changed.
     * This should not throw any errors but, rather, will handle any errors and just return false.
     * @param {Fixture} fixture - The fixture to be synced.
     * @return {Promise<boolean>} A boolean indicating the success, or otherwise, of the operation.
     */
    abstract sync(fixture: Fixture): Promise<boolean>;

}