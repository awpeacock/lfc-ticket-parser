import * as ICS from 'ics'

/**
 * Class representing a backup of any data that the parser has or will attempt to send.
 * It is to be persisted to a database before attempting to send the email, and only removed
 * upon a successful send.
 */
export default class Backup {

    /** The date on which the data was first generated for sending. */
    private date: Date;

    /** The sales data in ICS format that is to be backed up. */
    private events: Array<ICS.EventAttributes>;

    /**
     * Creates a Backup from the parameters provided.
     * @param {Date} date - The date on which the data was first generated for sending.
     * @param {Array<ICS.EventAttributes>} events - The sales data in ICS format that is to be/has been backed up.
     */
    constructor(date: Date, events: Array<ICS.EventAttributes>) {

        this.date = date;
        this.events = events;

    }

    /**
     * Returns the "key" with which the data is to be stored against.
     * @return {string} The backup's original date in the format YYYMMDD.
     */
    getKey(): string {
        return Backup.formatDate(this.date);
    }

    /**
     * Returns the sales data backed up by this object.
     * @return {Array<ICS.EventAttributes>} The sales data in ICS format that is to be/has been backed up.
     */
    getEvents(): Array<ICS.EventAttributes> {
        return this.events;
    }

    /**
     * Indicates whether this backup was created today.
     * @return {boolean>} Indicator whether the date for this backup is todayr or not.
     */
    isToday(): boolean {
        const today: Date = new Date();
        return (this.date.getFullYear() == today.getFullYear() && this.date.getMonth() == today.getMonth() && this.date.getDate() == today.getDate());
    }

    /**
     * Merges this Backup with another instance of a Backup (representing a different date's set of sales dates, so
     * that all get sent when the email finally succeeds).
     * @param {Backup} backup - The Backup object whose sales dates are to be added to this instance.
     */
    merge(backup: Backup): void {
        for ( let e = 0; e < backup.events.length; e++ ) {
            if ( !this.events.includes(backup.events[e]) ) {
                this.events.push(backup.events[e]);
            }
        }
    }

    /**
     * Converts the data represented by this Backup into JSON format for persisting in a database.
     * @return {string} A JSON representation of all the ICS-formatted sales dates.
     */
    toJson(): string {

        return JSON.stringify(this.events);

    }

    /**
     * Converts a JSON-formatted representation of a Backup into a Backup object.
     * @param {Date} date - The date on which the data was first generated for sending.
     * @param {string} json - The JSON representation of the ICS sales data.
     * @return {Backup} A Backup object instantiated from the date and JSON string.
     */
    static fromJson(date: Date, json: string): Backup {
        return new Backup(date, JSON.parse(json));
    }

    /**
     * Converts a Date into a string that can be used as the "key" for a Backup.
     * @param {Date} date - The date to be converted.
     * @return {string} The Date in the format YYYYMMDD.
     */
    static formatDate(date: Date): string {
        const y: number = date.getFullYear(), m: number = date.getMonth() + 1, d: number = date.getDate();
        return y.toString() + (m < 10 ? '0' : '') + m.toString() + (d < 10 ? '0' : '') + d.toString();
    }

    /**
     * Converts a string in a specific format (that is used as the "key" for a Backup in a database) into a Date object.
     * @param {string} date - The date in the format YYYYMMDD.
     * @return {Date} The converted Date represented by that string.
     */
    static parseDate(date: string): Date {
        const d: Date = new Date();
        d.setFullYear(parseInt(date.substring(0,4)));
        d.setMonth(parseInt(date.substring(4, 6)) - 1);
        d.setDate(parseInt(date.substring(6)));
        return d;
    }

}