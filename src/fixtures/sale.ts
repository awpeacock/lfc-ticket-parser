/**
 * Class representing details of an individual sale (or registration) associated with a fixture.
 */
export default class Sale {

    /** A brief summary of the sale type (e.g. Members Sale) plus any credit restrictions. */
    private description: string;
    /** The status of the sale (either pending, currently active or ended). */
    private status: Status;
    /** The date and time of the sale (if in the future). */
    private date: Nullable<Date>;

    /**
     * Creates a Sale from the parameters provided.
     * @param {string} description - A brief summary of the sale type (e.g. Members Sale) plus any credit restrictions.
     * @param {Status} status - The status of the sale/registration (either pending, currently active or ended).
     * @param {Nullable<Date>} date - The date and time of the sale (if in the future).
     */
    constructor(description: string, status: Status, date: Nullable<Date>) {
        this.description = description;
        this.date = date;
        this.status = status;
    }

    /**
     * Returns a boolean indicating whether the sale/registration is valid for inclusion in a calendar.
     * @return {boolean} A boolean representing whether it is still pending, has a date, isn't a local sale, and isn't for ambulant or hospitality seating.
     */
    isValid(): boolean {
        return this.status == Status.PENDING && this.date != null && !this.description.startsWith('Local') && !this.description.includes('ambulant') && this.description.indexOf('Hospitality') == -1;
    }

    /**
     * Returns a Json representation of the sale/registration.
     * @return {Nullable<string>} The Json string if it is valid, otherwise null.
     */
    getJson(): Nullable<string> {
        if ( !this.isValid() ) {
            return null;
        }
        return '{"description":"' + this.description + '","date":"' + this.date + '"}';
    }
}