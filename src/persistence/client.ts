import Fixture from "../fixtures/fixture";
import Backup from "./backup";

/**
 * Abstract class which all database clients must extend, containing all methods needed
 * to persist fixtures and sales dates, in order to determine if data has changed since the
 * last run of the parser (thus preventing unnecessary spamming of the same ICS entries;
 * and backups of the data that the parser attempted to send, to prevent sales information
 * being unsent.
 */
export default abstract class Client {

    /** The name of the tables on which to write fixture and backup details. */
    protected tables: TableTypes = {fixtures: '', backup: ''};

    /**
     * Creates a Client from the parameters provided.
     * @param {string} fixtures - The database table to contain the fixtures.
     * @param {string} backup - The database table to contain the ICS backup.
     */
    constructor(fixtures: string, backup: string) {
        this.tables.fixtures = fixtures;
        this.tables.backup = backup;
    }

    /**
     * Initialises the client - if this is the first time the parser has
     * run, it will automatically create the tables to store fixture and backup data.
     * This should not throw any errors but, rather, will handle any 
     * errors and just return false.
     * @return {Promise<boolean>} A boolean indicating the success, or otherwise, of the operation.
     */
    abstract init(): Promise<boolean>;

    /**
     * Deletes the tables storing fixture and backup data.  This should not throw any errors but, rather, will handle any 
     * errors and just return false.
     * @return {Promise<boolean>} A boolean indicating the success, or otherwise, of the operation.
     */
    abstract destroy(): Promise<boolean>;

    /**
     * Searches the database for the fixture provided (by the key created by the Fixture class),
     * and returns the JSON string containing all sales if it is found. 
     * @param {Fixture} fixture - The fixture to be retreieved from the database.
     * @return {Promise<Nullable<string>>} The JSON stored on the DB for the fixture (if present), otherwise null.
     * @throws Will throw an error if the attempt to retrieve fails, to prevent duplicate entries.
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

    /**
     * Stores the string representing the ICS file to be sent as a result of the parser, and the
     * date the parser first attempted to send it.
     * This should not throw any errors but, rather, will handle any errors and just return false.
     * @param {Backup} events - The Backup containing events in ICS format that represents sales dates.
     * @return {Promise<boolean>} A boolean indicating the success, or otherwise, of the operation.
     */
    abstract backup(events: Backup): Promise<boolean>;

    /**
     * Retrieves an array of Backup objects representing an ICS file that had previously failed to send, 
     * and updates the retry count. This should not throw any errors but, rather, will handle any errors 
     * and just return false.
     * @return {Promise<Array<Backup>>} The backup(s) of sales dates in ICS format.
     */
    abstract restore(): Promise<Array<Backup>>;

    /**
     * Removes any entries relating to a failed attempt to email an ICS file. This should not 
     * throw any errors but, rather, will handle any errors and just return false.
     * @param {Array<string>} dates - An array of all the backup "keys" in the database.
     * @return {Promise<boolean>} A boolean indicating the success, or otherwise, of the operation.
     */
    abstract reset(dates: Array<string>): Promise<boolean>;

}